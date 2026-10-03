import type { CoreSpinActionProposal } from './governed-execution';

export const XR_WORLD_READ_ROUTE_ID = 'route.xr-world.read';
export const XR_WORLD_READ_CAPABILITY = 'world.read';
export const XR_WORLD_READ_ACTION = 'READ_REGION';

export type CoreSpinXrIntentEnvelope = {
  intent_id: string;
  actor_id: string;
  capability_id: string;
  action: string;
  target?: string | null;
  payload_json: string;
  route_id?: string | null;
  approval_id?: string | null;
};

export type VerifiedXrActorContext = {
  ownerId: string;
  workspaceId: string;
};

const XR_WORLD_READ_FIELDS = [
  'schema_version',
  'command_id',
  'actor_avatar_id',
  'owner_id',
  'world_id',
  'region_id',
  'target_id',
  'action_type',
  'parameters',
  'expected_state_version',
  'capability_id',
  'policy_id',
  'logical_time',
  'idempotency_key',
] as const;

function requiredText(value: unknown, code: string, max = 512): string {
  if (typeof value !== 'string') throw new Error(code);
  const normalized = value.trim();
  if (!normalized || normalized.length > max || normalized.includes('\0')) {
    throw new Error(code);
  }
  return normalized;
}

function parsePayload(payloadJson: string): Record<string, unknown> {
  if (typeof payloadJson !== 'string' || payloadJson.length < 2 || payloadJson.length > 1_000_000) {
    throw new Error('XR_PAYLOAD_INVALID_JSON');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadJson);
  } catch {
    throw new Error('XR_PAYLOAD_INVALID_JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('XR_PAYLOAD_MUST_BE_OBJECT');
  }
  return parsed as Record<string, unknown>;
}

function requireExactReadFields(payload: Record<string, unknown>) {
  const keys = Object.keys(payload).sort();
  const expected = [...XR_WORLD_READ_FIELDS].sort();
  if (
    keys.length !== expected.length
    || keys.some((key, index) => key !== expected[index])
  ) {
    throw new Error('XR_WORLD_READ_PAYLOAD_FIELDS_INVALID');
  }
}

function validateReadPayload(
  envelope: CoreSpinXrIntentEnvelope,
  payload: Record<string, unknown>,
) {
  requireExactReadFields(payload);

  if (payload.schema_version !== 1) throw new Error('XR_WORLD_READ_SCHEMA_INVALID');
  if (payload.command_id !== envelope.intent_id) throw new Error('XR_PAYLOAD_ENVELOPE_MISMATCH');
  if (payload.actor_avatar_id !== envelope.actor_id) throw new Error('XR_PAYLOAD_ENVELOPE_MISMATCH');
  if (payload.capability_id !== envelope.capability_id) throw new Error('XR_PAYLOAD_ENVELOPE_MISMATCH');
  if (payload.action_type !== envelope.action) throw new Error('XR_PAYLOAD_ENVELOPE_MISMATCH');
  if (payload.target_id !== envelope.target) throw new Error('XR_PAYLOAD_ENVELOPE_MISMATCH');

  requiredText(payload.world_id, 'XR_WORLD_ID_INVALID', 256);
  requiredText(payload.region_id, 'XR_REGION_ID_INVALID', 256);
  requiredText(payload.owner_id, 'XR_OWNER_HINT_INVALID', 256);
  requiredText(payload.policy_id, 'XR_POLICY_ID_INVALID', 256);
  requiredText(payload.idempotency_key, 'XR_IDEMPOTENCY_KEY_INVALID', 256);

  if (
    !Number.isSafeInteger(payload.expected_state_version)
    || Number(payload.expected_state_version) < 0
  ) {
    throw new Error('XR_WORLD_EXPECTED_VERSION_INVALID');
  }

  if (
    !payload.parameters
    || typeof payload.parameters !== 'object'
    || Array.isArray(payload.parameters)
    || Object.keys(payload.parameters as Record<string, unknown>).length !== 0
  ) {
    throw new Error('XR_WORLD_READ_PARAMETERS_INVALID');
  }

  if (
    (typeof payload.logical_time !== 'string' && typeof payload.logical_time !== 'number')
    || (typeof payload.logical_time === 'number' && !Number.isFinite(payload.logical_time))
  ) {
    throw new Error('XR_WORLD_LOGICAL_TIME_INVALID');
  }
}

export function normalizeXrReadIntentToCoreSpin(
  envelope: CoreSpinXrIntentEnvelope,
  actor: VerifiedXrActorContext,
): CoreSpinActionProposal {
  const intentId = requiredText(envelope.intent_id, 'XR_INTENT_ID_INVALID', 160);
  const avatarId = requiredText(envelope.actor_id, 'XR_ACTOR_ID_INVALID', 160);
  const ownerId = requiredText(actor.ownerId, 'XR_VERIFIED_OWNER_REQUIRED', 256);
  const workspaceId = requiredText(actor.workspaceId, 'XR_VERIFIED_WORKSPACE_REQUIRED', 256);

  if (envelope.capability_id !== XR_WORLD_READ_CAPABILITY) {
    throw new Error('XR_CORE_SPIN_CAPABILITY_NOT_ALLOWED');
  }
  if (envelope.action !== XR_WORLD_READ_ACTION) {
    throw new Error('XR_CORE_SPIN_ACTION_NOT_ALLOWED');
  }
  if (envelope.target !== '*') {
    throw new Error('XR_CORE_SPIN_TARGET_NOT_ALLOWED');
  }
  if (
    envelope.route_id
    && envelope.route_id !== XR_WORLD_READ_ROUTE_ID
  ) {
    throw new Error('XR_CORE_SPIN_ROUTE_NOT_ALLOWED');
  }
  if (envelope.approval_id) {
    throw new Error('XR_CORE_SPIN_READ_APPROVAL_NOT_EXPECTED');
  }

  const payload = parsePayload(envelope.payload_json);
  validateReadPayload(envelope, payload);

  // Client owner_id is a non-authoritative hint. The DSG authenticated actor
  // becomes the exact owner bound into the Spacetime payload.
  const serverBoundPayload: Record<string, unknown> = {
    ...payload,
    owner_id: ownerId,
  };

  const worldId = requiredText(serverBoundPayload.world_id, 'XR_WORLD_ID_INVALID', 256);
  const regionId = requiredText(serverBoundPayload.region_id, 'XR_REGION_ID_INVALID', 256);
  const expectedStateVersion = Number(serverBoundPayload.expected_state_version);
  const planId = `xr-${intentId}`;

  return {
    taskId: intentId,
    planId,
    intent: `XR world.read READ_REGION world=${worldId} region=${regionId} target=*`,
    capability: XR_WORLD_READ_CAPABILITY,
    routeId: XR_WORLD_READ_ROUTE_ID,
    payload: serverBoundPayload,
    agentId: avatarId,
    principal: `workspace:${workspaceId}`,
    worldContext: {
      missionId: planId,
      ownerId,
      actorAvatarId: avatarId,
      worldId,
      regionId,
      expectedStateVersion,
    },
  };
}
