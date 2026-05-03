import type { AppBuilderGateIssue, AppBuilderGateResult, AppBuilderProposedPlan, AppBuilderRiskLevel } from './model';

const blockedExactPaths = ['**', '.env', '.env.local', '.env.production', '.git', 'node_modules'];
const blockedPathParts = ['../', '/.env', '.env.', '.git/', 'node_modules/'];
const blockedExactCommands = ['env', 'set', 'printenv'];

function maxRisk(a: AppBuilderRiskLevel, b: AppBuilderRiskLevel): AppBuilderRiskLevel {
  const order: AppBuilderRiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  return order.indexOf(a) >= order.indexOf(b) ? a : b;
}

function pathBlocked(path: string): boolean {
  const value = path.trim();
  return !value || value.startsWith('/') || blockedExactPaths.includes(value) || blockedPathParts.some((part) => value.includes(part));
}

function commandBlocked(command: string): boolean {
  return blockedExactCommands.includes(command.trim().toLowerCase());
}

function block(issues: AppBuilderGateIssue[], code: string, message: string, stepId?: string): void {
  issues.push({ code, message, severity: 'BLOCK', stepId });
}

export function gateAppBuilderPlan(plan: AppBuilderProposedPlan): AppBuilderGateResult {
  const issues: AppBuilderGateIssue[] = [];
  let riskLevel = plan.estimatedRiskLevel;

  if (!plan.steps.length) block(issues, 'PLAN_STEPS_REQUIRED', 'Plan must have steps.');
  for (const path of plan.allowedPaths) if (pathBlocked(path)) block(issues, 'BLOCKED_PLAN_PATH', path);
  for (const command of plan.allowedCommands) if (commandBlocked(command)) block(issues, 'BLOCKED_PLAN_COMMAND', command);

  for (const step of plan.steps) {
    riskLevel = maxRisk(riskLevel, step.riskLevel);
    if (!step.id.trim()) block(issues, 'STEP_ID_REQUIRED', 'Step id required.');
    for (const path of step.allowedPaths) if (pathBlocked(path)) block(issues, 'BLOCKED_PATH', path, step.id);
    for (const command of step.allowedCommands) if (commandBlocked(command)) block(issues, 'BLOCKED_COMMAND', command, step.id);
    if ((step.riskLevel === 'HIGH' || step.riskLevel === 'CRITICAL') && !step.requiresApproval) {
      block(issues, 'HIGH_RISK_REQUIRES_APPROVAL', step.id, step.id);
    }
  }

  const hasBlock = issues.some((item) => item.severity === 'BLOCK');
  return {
    status: hasBlock ? 'BLOCK' : riskLevel === 'LOW' ? 'PASS' : 'REVIEW',
    riskLevel,
    approvalRequired: riskLevel !== 'LOW' || plan.steps.some((step) => step.requiresApproval),
    issues,
  };
}
