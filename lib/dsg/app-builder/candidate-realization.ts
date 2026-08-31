import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { AppBuilderGoalInput, AppBuilderProposedPlan } from './model';
import { getAimoServiceConfig } from '@/lib/dsg/aimo/service-registry';

export const CANDIDATE_REALIZATION_SCHEMA_VERSION = 'dsg-candidate-realization-v1' as const;
export const REALIZATION_AUTHORIZATION_SCHEMA_VERSION = 'dsg-realization-authorization-v1' as const;

export interface CandidateRealizationSpecV1 {
  schemaVersion: typeof CANDIDATE_REALIZATION_SCHEMA_VERSION;
  candidateId: string;
  candidateKind: 'CONFIG_CANDIDATE' | 'CODE_CANDIDATE';
  goalId: string;
  targetRepository: string;
  baselineCommit: string;
  candidateCommit: string;
  approvedPlanHash: string;
  simulationHash: string;
  allowedPaths: string[];
  realization: {
    action: 'CONFIG_PROMOTION' | 'GENERATE_CODE_PATCH';
    capabilityId: string;
    capabilityDescription: string;
    acceptanceCriteria: string[];
  };
  objectiveContract: {
    metricName: string;
    direction: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
    baselineValue: number;
    candidateValue: number;
  };
  valueContract: {
    metricName: string;
    direction: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
    baselineValue: number;
    targetValue: number;
    measurementSource: string;
    guardrails: string[];
  } | null;
  requiredEvidence: string[];
  candidateAuthority: 'SIMULATION_ONLY';
  promotionAuthority: 'DSG_CONTROL_PLANE';
  selfPromotionAllowed: false;
  directProductionWriteAllowed: false;
  specSha256: string;
}

export interface RealizationAuthorizationReceipt {
  schemaVersion: typeof REALIZATION_AUTHORIZATION_SCHEMA_VERSION;
  status: 'ALLOW';
  candidateId: string;
  goalId: string;
  targetRepository: string;
  baselineCommit: string;
  originCandidateCommit: string;
  approvedPlanHash: string;
  specSha256: string;
  allowedPaths: string[];
  allowedOperations: Array<'READ' | 'WRITE' | 'TEST' | 'BUILD' | 'OPEN_PR'>;
  authority: 'DSG_CONTROL_PLANE';
  directProductionWriteAllowed: false;
  issuedAt: string;
  receiptSha256: string;
}

export interface StoredRealizationAuthorization {
  receipt: RealizationAuthorizationReceipt;
  receiptSignature: string;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function orderedSpecPayload(spec: CandidateRealizationSpecV1) {
  return {
    schemaVersion: spec.schemaVersion,
    candidateId: spec.candidateId,
    candidateKind: spec.candidateKind,
    goalId: spec.goalId,
    targetRepository: spec.targetRepository,
    baselineCommit: spec.baselineCommit,
    candidateCommit: spec.candidateCommit,
    approvedPlanHash: spec.approvedPlanHash,
    simulationHash: spec.simulationHash,
    allowedPaths: spec.allowedPaths,
    objectiveContract: spec.objectiveContract,
    candidateAuthority: spec.candidateAuthority,
    promotionAuthority: spec.promotionAuthority,
    selfPromotionAllowed: spec.selfPromotionAllowed,
    directProductionWriteAllowed: spec.directProductionWriteAllowed,
    realization: spec.realization,
    valueContract: spec.valueContract,
    requiredEvidence: spec.requiredEvidence,
  };
}

function receiptPayload(receipt: RealizationAuthorizationReceipt) {
  return {
    schemaVersion: receipt.schemaVersion,
    status: receipt.status,
    candidateId: receipt.candidateId,
    goalId: receipt.goalId,
    targetRepository: receipt.targetRepository,
    baselineCommit: receipt.baselineCommit,
    originCandidateCommit: receipt.originCandidateCommit,
    approvedPlanHash: receipt.approvedPlanHash,
    specSha256: receipt.specSha256,
    allowedPaths: receipt.allowedPaths,
    allowedOperations: receipt.allowedOperations,
    authority: receipt.authority,
    directProductionWriteAllowed: receipt.directProductionWriteAllowed,
    issuedAt: receipt.issuedAt,
  };
}

function canonicalPath(value: string): boolean {
  if (!value || value.startsWith('/') || value.endsWith('/') || value.includes('\\') || value.includes('\0')) return false;
  return value.split('/').every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}

function pathInsideScope(path: string, scope: string): boolean {
  const pathRoot = path.endsWith('/**') ? path.slice(0, -3) : path;
  if (!canonicalPath(pathRoot)) return false;
  if (scope.endsWith('/**')) {
    const root = scope.slice(0, -3);
    if (!canonicalPath(root)) return false;
    return pathRoot === root || pathRoot.startsWith(`${root}/`);
  }
  return !path.endsWith('/**') && canonicalPath(scope) && path === scope;
}

function intersectPathScopes(left: string, right: string): string | undefined {
  if (!pathInsideScope(left, right) && !pathInsideScope(right, left)) return undefined;
  if (pathInsideScope(left, right)) return left;
  return right;
}

export function verifyCandidateRealizationSpecV1(value: unknown): CandidateRealizationSpecV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('REALIZATION_SPEC_INVALID');
  const spec = value as CandidateRealizationSpecV1;
  if (spec.schemaVersion !== CANDIDATE_REALIZATION_SCHEMA_VERSION) throw new Error('REALIZATION_SPEC_SCHEMA_INVALID');
  if (spec.candidateKind !== 'CODE_CANDIDATE') throw new Error('APP_BUILDER_CODE_CANDIDATE_REQUIRED');
  if (spec.realization?.action !== 'GENERATE_CODE_PATCH') throw new Error('APP_BUILDER_REALIZATION_ACTION_INVALID');
  if (spec.candidateAuthority !== 'SIMULATION_ONLY' || spec.promotionAuthority !== 'DSG_CONTROL_PLANE') throw new Error('APP_BUILDER_REALIZATION_AUTHORITY_INVALID');
  if (spec.selfPromotionAllowed !== false || spec.directProductionWriteAllowed !== false) throw new Error('APP_BUILDER_REALIZATION_UNSAFE_AUTHORITY');
  if (!spec.valueContract) throw new Error('APP_BUILDER_REALIZATION_VALUE_CONTRACT_REQUIRED');
  if (!Array.isArray(spec.allowedPaths) || spec.allowedPaths.length === 0) throw new Error('APP_BUILDER_REALIZATION_PATH_SCOPE_REQUIRED');
  for (const path of spec.allowedPaths) {
    const root = path.endsWith('/**') ? path.slice(0, -3) : path;
    if (!canonicalPath(root)) throw new Error(`APP_BUILDER_REALIZATION_PATH_INVALID:${path}`);
  }
  if (!/^[0-9a-f]{40}$/i.test(spec.baselineCommit) || !/^[0-9a-f]{40}$/i.test(spec.candidateCommit)) throw new Error('APP_BUILDER_REALIZATION_COMMIT_INVALID');
  if (!/^[0-9a-f]{64}$/i.test(spec.specSha256) || sha256(JSON.stringify(orderedSpecPayload(spec))) !== spec.specSha256) throw new Error('APP_BUILDER_REALIZATION_SPEC_HASH_MISMATCH');
  return spec;
}

function authorizationSecret(env: NodeJS.ProcessEnv = process.env): string {
  const value = env.DSG_REALIZATION_AUTHORIZATION_SECRET?.trim() || env.DSG_PROMOTION_EVALUATION_SECRET?.trim();
  if (!value) throw new Error('APP_BUILDER_REALIZATION_AUTHORIZATION_SECRET_REQUIRED');
  return value;
}

export function verifyStoredRealizationAuthorization(
  specValue: unknown,
  authorization: StoredRealizationAuthorization,
  env: NodeJS.ProcessEnv = process.env,
): RealizationAuthorizationReceipt {
  const spec = verifyCandidateRealizationSpecV1(specValue);
  const receipt = authorization?.receipt;
  if (!receipt || receipt.schemaVersion !== REALIZATION_AUTHORIZATION_SCHEMA_VERSION || receipt.status !== 'ALLOW') throw new Error('APP_BUILDER_REALIZATION_RECEIPT_INVALID');
  if (receipt.authority !== 'DSG_CONTROL_PLANE' || receipt.directProductionWriteAllowed !== false) throw new Error('APP_BUILDER_REALIZATION_RECEIPT_AUTHORITY_INVALID');
  if (receipt.candidateId !== spec.candidateId || receipt.goalId !== spec.goalId || receipt.targetRepository !== spec.targetRepository) throw new Error('APP_BUILDER_REALIZATION_RECEIPT_BINDING_MISMATCH');
  if (receipt.baselineCommit !== spec.baselineCommit || receipt.originCandidateCommit !== spec.candidateCommit) throw new Error('APP_BUILDER_REALIZATION_RECEIPT_COMMIT_MISMATCH');
  if (receipt.approvedPlanHash !== spec.approvedPlanHash || receipt.specSha256 !== spec.specSha256) throw new Error('APP_BUILDER_REALIZATION_RECEIPT_HASH_BINDING_MISMATCH');
  if (sha256(JSON.stringify(receiptPayload(receipt))) !== receipt.receiptSha256) throw new Error('APP_BUILDER_REALIZATION_RECEIPT_HASH_MISMATCH');
  const signature = authorization.receiptSignature;
  if (!/^[0-9a-f]{64}$/i.test(signature || '')) throw new Error('APP_BUILDER_REALIZATION_RECEIPT_SIGNATURE_INVALID');
  const expected = createHmac('sha256', authorizationSecret(env)).update(JSON.stringify(receipt)).digest('hex');
  const actualBytes = Buffer.from(signature, 'hex');
  const expectedBytes = Buffer.from(expected, 'hex');
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) throw new Error('APP_BUILDER_REALIZATION_RECEIPT_SIGNATURE_INVALID');
  return receipt;
}

export async function requestRealizationAuthorization(
  specValue: unknown,
  options: { fetchImpl?: typeof fetch; env?: NodeJS.ProcessEnv } = {},
): Promise<StoredRealizationAuthorization> {
  const spec = verifyCandidateRealizationSpecV1(specValue);
  const env = options.env ?? process.env;
  const config = getAimoServiceConfig(env);
  if (!config.controlPlaneUrl) throw new Error('APP_BUILDER_CONTROL_PLANE_URL_REQUIRED');
  const endpoint = new URL('/api/dsg/agentic-org/realization/authorize', config.controlPlaneUrl);
  if (env.NODE_ENV === 'production' && endpoint.protocol !== 'https:') throw new Error('APP_BUILDER_CONTROL_PLANE_HTTPS_REQUIRED');

  const rawBody = JSON.stringify({ spec });
  const secret = authorizationSecret(env);
  const signature = createHmac('sha256', secret).update(rawBody).digest('hex');
  const response = await (options.fetchImpl ?? fetch)(endpoint, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-dsg-signature': `sha256=${signature}`,
    },
    body: rawBody,
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json().catch(() => null) as {
    status?: string;
    reason?: string;
    receipt?: RealizationAuthorizationReceipt;
    receiptSignature?: string;
  } | null;
  if (!response.ok || data?.status !== 'PASS' || !data.receipt || !data.receiptSignature) {
    throw new Error(`APP_BUILDER_REALIZATION_NOT_AUTHORIZED:${data?.reason || `HTTP_${response.status}`}`);
  }
  const authorization = { receipt: data.receipt, receiptSignature: data.receiptSignature };
  verifyStoredRealizationAuthorization(spec, authorization, env);
  return authorization;
}

export function appBuilderGoalFromCandidateRealization(specValue: unknown): AppBuilderGoalInput {
  const spec = verifyCandidateRealizationSpecV1(specValue);
  const value = spec.valueContract!;
  const target = `${value.metricName} ${value.direction === 'HIGHER_IS_BETTER' ? '>=' : '<='} ${value.targetValue} (baseline ${value.baselineValue})`;
  return {
    goal: spec.realization.capabilityDescription,
    successCriteria: [...spec.realization.acceptanceCriteria, `Value target: ${target}`, `Measurement source: ${value.measurementSource}`],
    constraints: [
      `Target repository: ${spec.targetRepository}`,
      `Authorized path scope: ${spec.allowedPaths.join(', ')}`,
      `Origin candidate commit: ${spec.candidateCommit}`,
      `Simulation spec SHA-256: ${spec.specSha256}`,
      'No direct production writes. Create a reviewable branch/PR only.',
      ...value.guardrails,
    ],
    userNotes: `Imported from governed simulation candidate ${spec.candidateId}; simulation authority is proposal-only and does not replace App Builder plan approval.`,
  };
}

export function constrainPlanToRealizationAuthorization(
  plan: AppBuilderProposedPlan,
  receipt: RealizationAuthorizationReceipt,
): AppBuilderProposedPlan {
  const constrain = (paths: string[]) => Array.from(new Set(paths.flatMap((path) => receipt.allowedPaths.map((allowed) => intersectPathScopes(path, allowed)).filter((value): value is string => Boolean(value)))));
  const steps = plan.steps.map((step) => ({ ...step, allowedPaths: constrain(step.allowedPaths) }));
  const allowedPaths = Array.from(new Set(steps.flatMap((step) => step.allowedPaths)));
  if (allowedPaths.length === 0) throw new Error('APP_BUILDER_REALIZATION_NO_PLAN_PATH_INTERSECTION');
  return {
    ...plan,
    steps,
    allowedPaths,
  };
}
