export const AGENTIC_IMPROVEMENT_SCHEMA_VERSION = 'dsg-agentic-improvement-v1' as const;

export interface ApprovedImprovementPlan {
  goalId: string;
  approvedPlanHash: string;
  targetRepository: string;
  baselineCommit: string;
  allowedPaths: string[];
  allowedOperations: Array<'READ' | 'WRITE' | 'TEST' | 'BUILD' | 'OPEN_PR'>;
}

export interface ImprovementExecutionRequest {
  schemaVersion: typeof AGENTIC_IMPROVEMENT_SCHEMA_VERSION;
  plan: ApprovedImprovementPlan;
  requestedPaths: string[];
  requestedOperations: ApprovedImprovementPlan['allowedOperations'];
  candidateId: string;
}

export interface ImprovementExecutionGateResult {
  status: 'READY' | 'BLOCKED';
  reasons: string[];
  approvedPlanHash: string;
  candidateId: string;
}

function isCanonicalRepoPath(value: string): boolean {
  if (!value || value.startsWith('/') || value.endsWith('/') || value.includes('\\') || value.includes('\0')) {
    return false;
  }
  const segments = value.split('/');
  return segments.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}

function pathAllowed(path: string, allowedPaths: string[]): boolean {
  if (!isCanonicalRepoPath(path)) return false;

  return allowedPaths.some((allowed) => {
    if (allowed.endsWith('/**')) {
      const root = allowed.slice(0, -3);
      return isCanonicalRepoPath(root) && path.startsWith(`${root}/`);
    }
    return isCanonicalRepoPath(allowed) && path === allowed;
  });
}

export function gateImprovementExecution(
  request: ImprovementExecutionRequest,
): ImprovementExecutionGateResult {
  const reasons: string[] = [];

  if (request.schemaVersion !== AGENTIC_IMPROVEMENT_SCHEMA_VERSION) {
    reasons.push('SCHEMA_VERSION_MISMATCH');
  }
  if (!request.plan.approvedPlanHash) {
    reasons.push('APPROVED_PLAN_HASH_MISSING');
  }
  if (!request.plan.baselineCommit) {
    reasons.push('BASELINE_COMMIT_MISSING');
  }
  if (request.plan.allowedPaths.length === 0) {
    reasons.push('ALLOWED_PATH_SCOPE_MISSING');
  }

  for (const allowed of request.plan.allowedPaths) {
    const root = allowed.endsWith('/**') ? allowed.slice(0, -3) : allowed;
    if (!isCanonicalRepoPath(root)) {
      reasons.push(`ALLOWED_PATH_SCOPE_INVALID:${allowed}`);
    }
  }

  for (const path of request.requestedPaths) {
    if (!pathAllowed(path, request.plan.allowedPaths)) {
      reasons.push(`PATH_OUTSIDE_APPROVED_SCOPE:${path}`);
    }
  }

  for (const operation of request.requestedOperations) {
    if (!request.plan.allowedOperations.includes(operation)) {
      reasons.push(`OPERATION_OUTSIDE_APPROVED_SCOPE:${operation}`);
    }
  }

  return {
    status: reasons.length === 0 ? 'READY' : 'BLOCKED',
    reasons,
    approvedPlanHash: request.plan.approvedPlanHash,
    candidateId: request.candidateId,
  };
}

export interface ImprovementRuntimeHandoff {
  schemaVersion: typeof AGENTIC_IMPROVEMENT_SCHEMA_VERSION;
  candidateId: string;
  goalId: string;
  approvedPlanHash: string;
  targetRepository: string;
  baselineCommit: string;
  allowedPaths: string[];
  allowedOperations: ApprovedImprovementPlan['allowedOperations'];
  executionAuthority: 'DSG_CONTROL_PLANE';
  promotionAuthority: 'DSG_CONTROL_PLANE';
}

export function buildImprovementRuntimeHandoff(
  request: ImprovementExecutionRequest,
): ImprovementRuntimeHandoff {
  const gate = gateImprovementExecution(request);
  if (gate.status !== 'READY') {
    throw new Error(`IMPROVEMENT_EXECUTION_BLOCKED:${gate.reasons.join(',')}`);
  }

  return {
    schemaVersion: AGENTIC_IMPROVEMENT_SCHEMA_VERSION,
    candidateId: request.candidateId,
    goalId: request.plan.goalId,
    approvedPlanHash: request.plan.approvedPlanHash,
    targetRepository: request.plan.targetRepository,
    baselineCommit: request.plan.baselineCommit,
    allowedPaths: [...request.plan.allowedPaths],
    allowedOperations: [...request.plan.allowedOperations],
    executionAuthority: 'DSG_CONTROL_PLANE',
    promotionAuthority: 'DSG_CONTROL_PLANE',
  };
}
