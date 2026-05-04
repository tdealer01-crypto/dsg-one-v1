from __future__ import annotations

from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple

from z3 import Bool, Solver, Implies, And, Not, sat, unsat


class GateStatus(str, Enum):
    PASS = "PASS"
    BLOCK = "BLOCK"
    REVIEW = "REVIEW"
    UNSUPPORTED = "UNSUPPORTED"


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ActionType(str, Enum):
    READ_FILE = "read_file"
    WRITE_FILE = "write_file"
    RUN_COMMAND = "run_command"
    CALL_API = "call_api"
    DEPLOY = "deploy"
    CREATE_DATABASE = "create_database"
    CHANGE_PERMISSION = "change_permission"
    CHARGE_PAYMENT = "charge_payment"


@dataclass(frozen=True)
class ProposedAction:
    id: str
    type: ActionType
    risk: RiskLevel = RiskLevel.LOW
    wave: int = 0
    depends_on: List[str] = field(default_factory=list)
    reads: List[str] = field(default_factory=list)
    writes: List[str] = field(default_factory=list)
    command: Optional[str] = None
    required_secrets: List[str] = field(default_factory=list)
    approved: bool = False


@dataclass(frozen=True)
class PlanSnapshot:
    job_id: str
    workspace_id: str
    goal_locked: bool
    plan_exists: bool
    available_secrets: List[str] = field(default_factory=list)
    allowed_paths: List[str] = field(default_factory=list)
    allowed_commands: List[str] = field(default_factory=list)
    actions: List[ProposedAction] = field(default_factory=list)


@dataclass
class GateReason:
    code: str
    message: str
    action_id: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Z3PlanObserverResult:
    gate_name: str
    status: GateStatus
    pass_: bool
    reasons: List[GateReason]
    z3_check: str
    summary: Dict[str, Any]


FORBIDDEN_PATH_PREFIXES = (".env", ".git", "node_modules")

HIGH_RISK_TYPES = {
    ActionType.DEPLOY,
    ActionType.CREATE_DATABASE,
    ActionType.CHANGE_PERMISSION,
    ActionType.CHARGE_PAYMENT,
}


def _normalize_path(path: str) -> str:
    return path.strip().replace("\\", "/").lstrip("./")


def _path_is_forbidden(path: str) -> bool:
    normalized = _normalize_path(path)
    if normalized == "" or normalized == "**" or normalized.startswith("**/"):
        return True
    return any(normalized == prefix or normalized.startswith(prefix + "/") for prefix in FORBIDDEN_PATH_PREFIXES)


def _path_allowed(path: str, allowed_paths: List[str]) -> bool:
    normalized = _normalize_path(path)
    if _path_is_forbidden(normalized):
        return False

    clean_allowed = [
        _normalize_path(p).rstrip("/")
        for p in allowed_paths
        if p.strip()
    ]
    if not clean_allowed or "**" in clean_allowed:
        return False

    return any(normalized == allowed or normalized.startswith(allowed + "/") for allowed in clean_allowed)


def _collect_write_conflicts(actions: List[ProposedAction]) -> List[GateReason]:
    reasons: List[GateReason] = []
    seen: Dict[Tuple[int, str], str] = {}
    for action in actions:
        for write_path in action.writes:
            normalized = _normalize_path(write_path)
            key = (action.wave, normalized)
            if key in seen:
                reasons.append(GateReason(
                    code="WRITE_CONFLICT_IN_SAME_WAVE",
                    message="Two actions write to the same target in the same wave.",
                    action_id=action.id,
                    details={"wave": action.wave, "path": normalized, "first_action_id": seen[key], "second_action_id": action.id},
                ))
            else:
                seen[key] = action.id
    return reasons


def _collect_dependency_errors(actions: List[ProposedAction]) -> List[GateReason]:
    reasons: List[GateReason] = []
    by_id = {action.id: action for action in actions}
    for action in actions:
        for dep_id in action.depends_on:
            dep = by_id.get(dep_id)
            if dep is None:
                reasons.append(GateReason(
                    code="MISSING_DEPENDENCY",
                    message="Action depends on a missing action.",
                    action_id=action.id,
                    details={"missing_dependency": dep_id},
                ))
                continue
            if dep.wave >= action.wave:
                reasons.append(GateReason(
                    code="DEPENDENCY_ORDER_VIOLATION",
                    message="Action dependency must run in an earlier wave.",
                    action_id=action.id,
                    details={"dependency_id": dep.id, "dependency_wave": dep.wave, "action_wave": action.wave},
                ))

    cycle = _find_cycle(actions)
    if cycle:
        reasons.append(GateReason(code="CYCLIC_DEPENDENCY", message="Plan contains a cyclic dependency.", details={"cycle": cycle}))
    return reasons


def _find_cycle(actions: List[ProposedAction]) -> Optional[List[str]]:
    graph = {action.id: list(action.depends_on) for action in actions}
    visiting: Set[str] = set()
    visited: Set[str] = set()
    stack: List[str] = []

    def dfs(node: str) -> Optional[List[str]]:
        if node in visiting:
            return stack[stack.index(node):] + [node] if node in stack else [node]
        if node in visited:
            return None
        visiting.add(node)
        stack.append(node)
        for dep in graph.get(node, []):
            if dep in graph:
                found = dfs(dep)
                if found:
                    return found
        stack.pop()
        visiting.remove(node)
        visited.add(node)
        return None

    for node in graph:
        found = dfs(node)
        if found:
            return found
    return None


def observe_plan_feasibility(snapshot: PlanSnapshot) -> Z3PlanObserverResult:
    """
    Z3 ชั้น 2:
    - ไม่ execute
    - ไม่ approve
    - ไม่แทน RBAC / Risk Control / Executor
    - ดูแค่ว่า plan เป็นไปได้ไหม / ขัดกันไหม / ของครบไหม
    """
    reasons: List[GateReason] = []

    if not snapshot.goal_locked:
        reasons.append(GateReason(code="NO_GOAL_LOCK", message="Plan feasibility check requires a locked goal."))
    if not snapshot.plan_exists:
        reasons.append(GateReason(code="NO_PLAN", message="No proposed plan exists."))
    if not snapshot.actions:
        reasons.append(GateReason(code="NO_ACTIONS", message="Plan has no actions."))

    available_secrets = set(snapshot.available_secrets)
    allowed_commands = set(snapshot.allowed_commands)

    for action in snapshot.actions:
        for secret in action.required_secrets:
            if secret not in available_secrets:
                reasons.append(GateReason(
                    code="MISSING_REQUIRED_SECRET",
                    message="Action requires a secret that is not available.",
                    action_id=action.id,
                    details={"secret": secret},
                ))

        for write_path in action.writes:
            if _path_is_forbidden(write_path):
                reasons.append(GateReason(code="FORBIDDEN_WRITE_PATH", message="Action attempts to write to a forbidden path.", action_id=action.id, details={"path": write_path}))
            elif not _path_allowed(write_path, snapshot.allowed_paths):
                reasons.append(GateReason(code="WRITE_PATH_NOT_ALLOWED", message="Action writes outside allowed paths.", action_id=action.id, details={"path": write_path, "allowed_paths": snapshot.allowed_paths}))

        if action.type == ActionType.RUN_COMMAND:
            if not action.command:
                reasons.append(GateReason(code="MISSING_COMMAND", message="run_command action has no command.", action_id=action.id))
            elif action.command not in allowed_commands:
                reasons.append(GateReason(code="COMMAND_NOT_ALLOWED", message="Command is not in the allowlist.", action_id=action.id, details={"command": action.command, "allowed_commands": snapshot.allowed_commands}))

        if action.type in HIGH_RISK_TYPES and not action.approved:
            reasons.append(GateReason(
                code="HIGH_RISK_ACTION_NOT_APPROVED",
                message="High-risk action exists without approval. Z3 observer reports this, but approval is still controlled by Risk Control.",
                action_id=action.id,
                details={"action_type": action.type.value, "risk": action.risk.value},
            ))

    reasons.extend(_collect_write_conflicts(snapshot.actions))
    reasons.extend(_collect_dependency_errors(snapshot.actions))
    z3_result = _run_z3_consistency_check(snapshot, reasons)

    if z3_result == "sat" and not reasons:
        status = GateStatus.PASS
    elif z3_result == "unsat" or reasons:
        status = GateStatus.BLOCK
    else:
        status = GateStatus.REVIEW

    return Z3PlanObserverResult(
        gate_name="Z3_PLAN_FEASIBILITY_OBSERVER",
        status=status,
        pass_=status == GateStatus.PASS,
        reasons=reasons,
        z3_check=z3_result,
        summary={
            "job_id": snapshot.job_id,
            "workspace_id": snapshot.workspace_id,
            "actions": len(snapshot.actions),
            "waves": sorted({a.wave for a in snapshot.actions}),
            "blocked_reasons": len(reasons),
        },
    )


def _run_z3_consistency_check(snapshot: PlanSnapshot, reasons: List[GateReason]) -> str:
    solver = Solver()
    goal_locked = Bool("goal_locked")
    plan_exists = Bool("plan_exists")
    no_blockers = Bool("no_blockers")
    plan_feasible = Bool("plan_feasible")

    solver.add(goal_locked == snapshot.goal_locked)
    solver.add(plan_exists == snapshot.plan_exists)
    solver.add(no_blockers == (len(reasons) == 0))
    solver.add(plan_feasible == And(goal_locked, plan_exists, no_blockers))
    solver.add(Implies(Not(goal_locked), Not(plan_feasible)))
    solver.add(Implies(Not(plan_exists), Not(plan_feasible)))
    solver.add(Implies(Not(no_blockers), Not(plan_feasible)))
    solver.add(plan_feasible)

    result = solver.check()
    if result == sat:
        return "sat"
    if result == unsat:
        return "unsat"
    return "unknown"


def result_to_dict(result: Z3PlanObserverResult) -> Dict[str, Any]:
    return {
        "gate_name": result.gate_name,
        "status": result.status.value,
        "pass": result.pass_,
        "z3_check": result.z3_check,
        "summary": result.summary,
        "reasons": [asdict(reason) for reason in result.reasons],
    }


if __name__ == "__main__":
    demo = PlanSnapshot(
        job_id="job_demo",
        workspace_id="workspace_demo",
        goal_locked=True,
        plan_exists=True,
        available_secrets=["OPENROUTER_API_KEY"],
        allowed_paths=["app", "lib", "components"],
        allowed_commands=["npm test", "npm run build"],
        actions=[
            ProposedAction(id="step_1", type=ActionType.WRITE_FILE, wave=1, writes=["lib/dsg/core.ts"]),
            ProposedAction(id="step_2", type=ActionType.WRITE_FILE, wave=1, writes=["lib/dsg/core.ts"]),
            ProposedAction(
                id="step_3",
                type=ActionType.DEPLOY,
                risk=RiskLevel.HIGH,
                wave=2,
                depends_on=["step_1"],
                required_secrets=["VERCEL_TOKEN"],
                approved=False,
            ),
        ],
    )
    print(result_to_dict(observe_plan_feasibility(demo)))
