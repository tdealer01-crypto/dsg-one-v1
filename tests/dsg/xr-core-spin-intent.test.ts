import { describe, expect, it } from 'vitest';

import {
  normalizeXrReadIntentToCoreSpin,
  XR_WORLD_READ_ROUTE_ID,
} from '../../lib/dsg/core-spin/xr-intent';

function envelope(overrides: Record<string, unknown> = {}) {
  const intentId = String(overrides.intent_id ?? 'intent-1');
  const actorId = String(overrides.actor_id ?? 'avatar-1');
  const payload = {
    schema_version: 1,
    command_id: intentId,
    actor_avatar_id: actorId,
    owner_id: 'client-untrusted-owner',
    world_id: 'ai-commons',
    region_id: 'commons',
    target_id: '*',
    action_type: 'READ_REGION',
    parameters: {},
    expected_state_version: 0,
    capability_id: 'world.read',
    policy_id: 'policy-world-read',
    logical_time: 1,
    idempotency_key: `read-${intentId}`,
    ...(overrides.payload as Record<string, unknown> | undefined),
  };
  return {
    intent_id: intentId,
    actor_id: actorId,
    capability_id: String(overrides.capability_id ?? 'world.read'),
    action: String(overrides.action ?? 'READ_REGION'),
    target: String(overrides.target ?? '*'),
    payload_json: JSON.stringify(payload),
    route_id: String(overrides.route_id ?? XR_WORLD_READ_ROUTE_ID),
    approval_id: '',
  };
}

describe('XR -> Core Spin adapter', () => {
  it('server-binds owner and creates the strict world.read proposal', () => {
    const proposal = normalizeXrReadIntentToCoreSpin(
      envelope(),
      { ownerId: 'verified-user-1', principal: 'workspace:workspace-1' },
    );

    expect(proposal.planId).toBe('xr-intent-1');
    expect(proposal.capability).toBe('world.read');
    expect(proposal.routeId).toBe('route.xr-world.read');
    expect(proposal.principal).toBe('workspace:workspace-1');
    expect(proposal.payload).toMatchObject({
      owner_id: 'verified-user-1',
      actor_avatar_id: 'avatar-1',
      world_id: 'ai-commons',
      region_id: 'commons',
      action_type: 'READ_REGION',
      expected_state_version: 0,
    });
    expect(proposal.worldContext).toEqual({
      missionId: 'xr-intent-1',
      ownerId: 'verified-user-1',
      actorAvatarId: 'avatar-1',
      worldId: 'ai-commons',
      regionId: 'commons',
      expectedStateVersion: 0,
    });
  });

  it('blocks capability escalation', () => {
    expect(() => normalizeXrReadIntentToCoreSpin(
      envelope({ capability_id: 'world.write' }),
      { ownerId: 'verified-user-1', principal: 'workspace:workspace-1' },
    )).toThrow('XR_CORE_SPIN_CAPABILITY_NOT_ALLOWED');
  });

  it('blocks envelope/payload mirror mismatch', () => {
    expect(() => normalizeXrReadIntentToCoreSpin(
      envelope({ payload: { command_id: 'different' } }),
      { ownerId: 'verified-user-1', principal: 'workspace:workspace-1' },
    )).toThrow('XR_PAYLOAD_ENVELOPE_MISMATCH');
  });

  it('blocks extra fields instead of silently passing them to Spacetime', () => {
    expect(() => normalizeXrReadIntentToCoreSpin(
      envelope({ payload: { unexpected: true } }),
      { ownerId: 'verified-user-1', principal: 'workspace:workspace-1' },
    )).toThrow('XR_WORLD_READ_PAYLOAD_FIELDS_INVALID');
  });

  it('blocks non-empty read parameters', () => {
    expect(() => normalizeXrReadIntentToCoreSpin(
      envelope({ payload: { parameters: { mutate: true } } }),
      { ownerId: 'verified-user-1', principal: 'workspace:workspace-1' },
    )).toThrow('XR_WORLD_READ_PARAMETERS_INVALID');
  });
});
