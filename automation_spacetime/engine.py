from __future__ import annotations

import asyncio
import json
import sys
from importlib.metadata import version
from typing import Any

from agent_framework import Executor, InMemoryCheckpointStorage, WorkflowBuilder, WorkflowContext, handler
from agent_framework.orchestrations import (
    ConcurrentBuilder,
    GroupChatBuilder,
    HandoffBuilder,
    MagenticBuilder,
    SequentialBuilder,
)

from checkpoint_store import SupabaseCheckpointStorage


FRAMEWORK_VERSION = "1.18.0"


def _ready_steps(payload: dict[str, Any]) -> list[str]:
    tasks = payload.get("tasks") or []
    completed = set(payload.get("completed_step_ids") or [])
    blocked = set(payload.get("blocked_step_ids") or [])
    ready: list[str] = []
    for task in tasks:
        task_id = str(task.get("id") or "")
        if not task_id or task_id in completed or task_id in blocked:
            continue
        dependencies = {str(value) for value in task.get("dependsOn") or []}
        if dependencies.issubset(completed):
            ready.append(task_id)
    return sorted(set(ready))


class NormalizeExecutor(Executor):
    def __init__(self) -> None:
        super().__init__(id="dsg_automation_normalize")

    @handler
    async def normalize(self, payload: dict[str, Any], ctx: WorkflowContext[dict[str, Any]]) -> None:
        await ctx.send_message(payload)


class DecisionExecutor(Executor):
    def __init__(self) -> None:
        super().__init__(id="dsg_automation_decide")
        self.last_decision: dict[str, Any] | None = None

    @handler
    async def decide(self, payload: dict[str, Any], ctx: WorkflowContext[Any, dict[str, Any]]) -> None:
        tasks = payload.get("tasks") or []
        completed = set(payload.get("completed_step_ids") or [])
        blocked = set(payload.get("blocked_step_ids") or [])
        ready = _ready_steps(payload)
        task_ids = {str(task.get("id") or "") for task in tasks if task.get("id")}
        if task_ids and task_ids.issubset(completed):
            status = "COMPLETE"
        elif ready:
            status = "READY"
        elif blocked:
            status = "BLOCKED"
        else:
            status = "WAIT"
        self.last_decision = {
            "status": status,
            "ready_step_ids": ready,
            "execution_mode": "PARALLEL" if len(ready) > 1 else "SEQUENTIAL",
            "requires_governance_spacetime": status == "READY",
        }
        await ctx.yield_output(self.last_decision)

    async def on_checkpoint_save(self) -> dict[str, Any]:
        return {"last_decision": self.last_decision}

    async def on_checkpoint_restore(self, state: dict[str, Any]) -> None:
        self.last_decision = state.get("last_decision")


async def _run_evaluate(payload: dict[str, Any]) -> dict[str, Any]:
    run_id = str(payload.get("run_id") or "")
    if not run_id:
        raise ValueError("AUTOMATION_RUN_ID_REQUIRED")
    storage = SupabaseCheckpointStorage(run_id=run_id)
    normalize = NormalizeExecutor()
    decide = DecisionExecutor()
    workflow = (
        WorkflowBuilder(
            start_executor=normalize,
            checkpoint_storage=storage,
            name=f"dsg-automation:{run_id}",
        )
        .add_edge(normalize, decide)
        .build()
    )
    result = await workflow.run(payload)
    outputs = result.get_outputs()
    if not outputs or not isinstance(outputs[-1], dict):
        raise RuntimeError("AUTOMATION_ENGINE_OUTPUT_INVALID")
    return outputs[-1]


async def _probe() -> dict[str, Any]:
    installed = version("agent-framework")
    storage = InMemoryCheckpointStorage()
    normalize = NormalizeExecutor()
    decide = DecisionExecutor()
    workflow = (
        WorkflowBuilder(
            start_executor=normalize,
            checkpoint_storage=storage,
            name="dsg-automation-probe",
        )
        .add_edge(normalize, decide)
        .build()
    )
    result = await workflow.run({
        "tasks": [{"id": "probe", "dependsOn": []}],
        "completed_step_ids": [],
        "blocked_step_ids": [],
    })
    outputs = result.get_outputs()
    latest = await storage.get_latest(workflow_name=workflow.name)
    workflow_ok = bool(outputs and outputs[-1].get("status") == "READY" and latest is not None)
    return {
        "ok": installed == FRAMEWORK_VERSION and workflow_ok,
        "engine": "microsoft-agent-framework",
        "version": installed,
        "required_version": FRAMEWORK_VERSION,
        "workflow_probe": workflow_ok,
        "checkpoint_probe": latest is not None,
        "capabilities": [
            SequentialBuilder.__name__,
            ConcurrentBuilder.__name__,
            HandoffBuilder.__name__,
            GroupChatBuilder.__name__,
            MagenticBuilder.__name__,
            WorkflowBuilder.__name__,
        ],
        "execution_authority": "proposal-only",
        "governance_authority": "dsg-spacetime",
    }


async def _main() -> int:
    raw = sys.stdin.read()
    request = json.loads(raw or "{}")
    operation = request.get("operation")
    if operation == "probe":
        response = await _probe()
    elif operation == "evaluate":
        response = await _run_evaluate(request)
    else:
        raise ValueError("AUTOMATION_OPERATION_UNSUPPORTED")
    sys.stdout.write(json.dumps(response, separators=(",", ":"), ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(asyncio.run(_main()))
    except Exception as exc:
        sys.stdout.write(json.dumps({"ok": False, "error": exc.__class__.__name__, "code": str(exc)[:300]}))
        raise SystemExit(1)
