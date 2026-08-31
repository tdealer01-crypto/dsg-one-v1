import type { AppBuilderJob } from './model';
import {
  verifyStoredRealizationAuthorization,
  type RealizationAuthorizationReceipt,
  type StoredRealizationAuthorization,
} from './candidate-realization';

function canonicalPath(value: string): boolean {
  if (!value || value.startsWith('/') || value.endsWith('/') || value.includes('\\') || value.includes('\0')) return false;
  return value.split('/').every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}

function pathWithin(path: string, scope: string): boolean {
  const pathRoot = path.endsWith('/**') ? path.slice(0, -3) : path;
  if (!canonicalPath(pathRoot)) return false;
  if (scope.endsWith('/**')) {
    const root = scope.slice(0, -3);
    return canonicalPath(root) && (pathRoot === root || pathRoot.startsWith(`${root}/`));
  }
  return !path.endsWith('/**') && canonicalPath(scope) && path === scope;
}

export function assertCandidateRealizationExecutionAuthorized(
  job: AppBuilderJob,
  env: NodeJS.ProcessEnv = process.env,
): RealizationAuthorizationReceipt | undefined {
  if (job.metadata?.intakeSource !== 'GOVERNED_SIMULATION_CANDIDATE') return undefined;
  if (!job.approvedPlan) throw new Error('APP_BUILDER_REALIZATION_APPROVED_PLAN_REQUIRED');

  const spec = job.metadata.candidateRealizationSpec;
  const authorization = job.metadata.realizationAuthorization as StoredRealizationAuthorization | undefined;
  if (!authorization) throw new Error('APP_BUILDER_REALIZATION_AUTHORIZATION_REQUIRED');
  const receipt = verifyStoredRealizationAuthorization(spec, authorization, env);

  if (!receipt.allowedOperations.includes('WRITE') || !receipt.allowedOperations.includes('OPEN_PR')) {
    throw new Error('APP_BUILDER_REALIZATION_WRITE_OR_PR_NOT_AUTHORIZED');
  }

  const planPaths = [
    ...job.approvedPlan.proposedPlan.allowedPaths,
    ...job.approvedPlan.proposedPlan.steps.flatMap((step) => step.allowedPaths),
  ];
  const outside = Array.from(new Set(planPaths.filter((path) => !receipt.allowedPaths.some((scope) => pathWithin(path, scope)))));
  if (outside.length > 0) throw new Error(`APP_BUILDER_REALIZATION_APPROVED_PLAN_SCOPE_WIDENED:${outside.join(',')}`);

  return receipt;
}
