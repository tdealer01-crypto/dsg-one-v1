import { asRecord, spacetimePayloadHash, type JsonRecord, type WorkroomExecution } from './workroom-contract';

const HASH = /^[a-f0-9]{64}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/;
const WRITE_ROUTE = 'route.desktop-native.fs-write';
const READ_ROUTE = 'route.desktop-native.fs-read';

export type NativeBoundedDraft = {
  workspaceId: string;
  deviceId: string;
  requests: WorkroomExecution[];
  readRequest: WorkroomExecution;
  path: string;
  content: string;
};
export type BoundedPreview = {
  requestId: string;
  reviewDigest: string;
  planId: string;
  planHash: string;
  workspaceId: string;
  deviceId: string;
  expiresAt: number;
  steps: { stepId: string; routeId: string; summary: string; target: string; payloadHash: string;
    origin: string; effect: string; risk: string }[];
};

function exactKeys(value: JsonRecord, keys: string[]) {
  return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}

// These are existing composer outputs, not a second plan compiler. The read
// stays in the same immutable plan; only the write may request owner consent.
export function nativeBoundedDraft(write: WorkroomExecution, read: WorkroomExecution,
  context: { workspaceId: string; deviceId: string }): NativeBoundedDraft {
  const args = asRecord(write.payload.arguments);
  const readArgs = asRecord(read.payload.arguments);
  if (!ID.test(context.workspaceId) || !ID.test(context.deviceId) ||
      write.route_id !== WRITE_ROUTE || read.route_id !== READ_ROUTE ||
      !ID.test(write.plan_id) || !HASH.test(write.plan_hash) ||
      write.plan_id !== read.plan_id || write.plan_hash !== read.plan_hash ||
      !write.agent.principal.startsWith('oauth:') || write.agent.principal.length <= 6 ||
      write.agent.principal !== read.agent.principal || write.agent.agent_id !== read.agent.agent_id ||
      write.payload.action !== 'device.fs.write' || read.payload.action !== 'device.fs.read' ||
      !args || !exactKeys(args, ['path', 'content', 'mode']) || args.mode !== 'create_new' ||
      typeof args.path !== 'string' || !args.path || typeof args.content !== 'string' ||
      !readArgs || !exactKeys(readArgs, ['path']) || readArgs.path !== args.path) {
    throw new Error('BOUNDED_NATIVE_WRITE_READ_PLAN_REQUIRED');
  }
  return { ...context, requests: [structuredClone(write)], readRequest: structuredClone(read),
    path: args.path, content: args.content };
}

export async function verifyBoundedPreview(value: unknown, draft: NativeBoundedDraft,
  requestId: string, reviewExpiresAt?: number): Promise<BoundedPreview> {
  const raw = asRecord(value);
  const scope = asRecord(raw?.scope);
  const first = draft.requests[0];
  if (!raw || !scope || !ID.test(requestId) || raw.request_id !== requestId || raw.status !== 'VIEWED' ||
      typeof raw.review_digest !== 'string' || !HASH.test(raw.review_digest) ||
      scope.plan_id !== first.plan_id || scope.plan_hash !== first.plan_hash ||
      scope.workspace_id !== draft.workspaceId || scope.device_id !== draft.deviceId ||
      scope.agent_id !== first.agent.agent_id ||
      typeof scope.expires_at !== 'number' || !Number.isInteger(scope.expires_at) ||
      !Array.isArray(scope.steps) || scope.steps.length !== draft.requests.length) {
    throw new Error('BOUNDED_REVIEW_SCOPE_NOT_VERIFIED');
  }
  const expiresAt = Math.min(scope.expires_at,
    typeof reviewExpiresAt === 'number' ? reviewExpiresAt : scope.expires_at);
  if (expiresAt <= Math.floor(Date.now() / 1000)) throw new Error('BOUNDED_REVIEW_EXPIRED');
  const seen = new Set<string>();
  const steps = [];
  for (const [index, item] of scope.steps.entries()) {
    const step = asRecord(item);
    const request = draft.requests[index];
    if (!step || typeof step.step_id !== 'string' || !ID.test(step.step_id) || seen.has(step.step_id) ||
        step.route_id !== request.route_id || step.payload_hash !== await spacetimePayloadHash(request.payload) ||
        step.origin !== 'https://aws.dsg.pics' || step.risk !== 'high' || step.effect !== 'file_write_exact' ||
        step.target_ref !== draft.path || typeof step.review_summary !== 'string' ||
        !step.review_summary || step.review_summary.length > 1024) {
      throw new Error('BOUNDED_REVIEW_PAYLOAD_NOT_VERIFIED');
    }
    seen.add(step.step_id);
    steps.push({ stepId: step.step_id, routeId: request.route_id, summary: step.review_summary,
      target: draft.path, payloadHash: step.payload_hash as string,
      origin: step.origin as string, effect: step.effect as string, risk: step.risk as string });
  }
  return { requestId, reviewDigest: raw.review_digest, planId: first.plan_id,
    planHash: first.plan_hash, workspaceId: draft.workspaceId, deviceId: draft.deviceId,
    expiresAt, steps };
}

export function mayConfirmBoundedReview(
  state: { acknowledged: boolean; submissionStarted: boolean; reviewedGeneration: number },
  currentGeneration: number,
) {
  return state.acknowledged && !state.submissionStarted && state.reviewedGeneration === currentGeneration;
}

type BoundedAttemptState = { submissionStarted: boolean; report?: JsonRecord; grantId?: string };
type UpdatedAttempt<T extends BoundedAttemptState> = Omit<T, keyof BoundedAttemptState> & BoundedAttemptState;

export function consumeBoundedConfirmation<T extends BoundedAttemptState>(current: T): UpdatedAttempt<T> {
  return { ...current, submissionStarted: true, report: undefined };
}

export function applyBoundedStatus<T extends BoundedAttemptState>(current: T, report: JsonRecord): UpdatedAttempt<T> {
  const alreadySubmitted = report.authorization_status !== 'NOT_GRANTED' ||
    !['WAITING_REVIEW', 'WAITING_MFA'].includes(String(report.status));
  return { ...current, report, submissionStarted: current.submissionStarted || alreadySubmitted,
    grantId: typeof report.grant_id === 'string' ? report.grant_id : current.grantId };
}

export function boundedPlanMayClose(current: BoundedAttemptState): boolean {
  return !current.submissionStarted || ['COMPLETED', 'REVOKED', 'EXPIRED'].includes(String(current.report?.status)) ||
    current.report?.authorization_status === 'NOT_GRANTED';
}

// Both checks matter: a user can leave or change context while the fresh MFA
// popup is open. Consume the attempt before network I/O; uncertainty is read-only.
export async function confirmReviewedBoundedPlan(preview: BoundedPreview, lifecycle: {
  isCurrent: () => boolean;
  requestMfa: () => Promise<string | undefined>;
  onSubmitting: () => void;
  confirm: (token: string, args: JsonRecord) => Promise<JsonRecord>;
}): Promise<JsonRecord> {
  const current = () => lifecycle.isCurrent() && preview.expiresAt > Math.floor(Date.now() / 1000);
  if (!current()) throw new Error('BOUNDED_REVIEW_CHANGED_OR_EXPIRED');
  const token = await lifecycle.requestMfa();
  if (!token || !current()) throw new Error('BOUNDED_REVIEW_CHANGED_OR_EXPIRED');
  lifecycle.onSubmitting();
  return lifecycle.confirm(token, { request_id: preview.requestId, reviewed_digest: preview.reviewDigest });
}

export function verifiedBoundedCompletion(value: unknown, preview: BoundedPreview): boolean {
  const status = asRecord(value);
  if (!status || status.workflow_version !== 'dsg.bounded-plan.workflow.v1' ||
      status.request_id !== preview.requestId || status.plan_id !== preview.planId ||
      status.plan_hash !== preview.planHash || status.workspace_id !== preview.workspaceId ||
      status.device_id !== preview.deviceId || status.status !== 'COMPLETED' ||
      status.completion_verified !== true || status.automatic_retry !== false ||
      status.total_steps !== preview.steps.length || status.completed_steps !== preview.steps.length ||
      !Array.isArray(status.steps) || status.steps.length !== preview.steps.length) return false;
  const observedSteps = status.steps;
  return preview.steps.every(expected => observedSteps.some((item: unknown) => {
    const step = asRecord(item);
    return step?.step_id === expected.stepId && step.route_id === expected.routeId &&
      step.status === 'COMPLETED' && typeof step.evidence_hash === 'string' && HASH.test(step.evidence_hash);
  }));
}
