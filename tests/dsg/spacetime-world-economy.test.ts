import { describe, expect, it } from 'vitest';

import {
  buildCanonicalWorldEvent,
  evaluateDelegatedSpend,
  selectProviderCapability,
  type DelegatedWallet,
} from '../../lib/dsg/spacetime/world-economy';

const wallet: DelegatedWallet = {
  ownerId: 'user-1',
  delegateAgentId: 'agent-1',
  currency: 'THB',
  availableMinor: 500_000,
  perTransactionLimitMinor: 150_000,
  dailyLimitMinor: 300_000,
  spentTodayMinor: 0,
  approvalThresholdMinor: 100_000,
  allowedCategories: ['groceries', 'utilities'],
  allowedMerchants: [],
};

describe('DSG Spacetime world economy contracts', () => {
  it('allows a delegated spend inside the exact envelope', () => {
    expect(evaluateDelegatedSpend(wallet, {
      ownerId: 'user-1',
      agentId: 'agent-1',
      currency: 'THB',
      amountMinor: 75_000,
      category: 'groceries',
      merchantId: 'merchant-1',
    })).toEqual({ verdict: 'ALLOW' });
  });

  it('requires approval above the delegated threshold', () => {
    expect(evaluateDelegatedSpend(wallet, {
      ownerId: 'user-1',
      agentId: 'agent-1',
      currency: 'THB',
      amountMinor: 120_000,
      category: 'groceries',
      merchantId: 'merchant-1',
    })).toEqual({
      verdict: 'WAITING_APPROVAL',
      reason: 'APPROVAL_THRESHOLD',
    });
  });

  it('blocks a different agent from spending the owner envelope', () => {
    expect(evaluateDelegatedSpend(wallet, {
      ownerId: 'user-1',
      agentId: 'agent-other',
      currency: 'THB',
      amountMinor: 10_000,
      category: 'groceries',
      merchantId: 'merchant-1',
    })).toEqual({
      verdict: 'BLOCK',
      reason: 'DELEGATION_MISMATCH',
    });
  });

  it('selects only an explicitly available provider capability', () => {
    const providers = [{
      providerId: 'provider-live',
      status: 'AVAILABLE' as const,
      operations: ['READ'],
      routeId: 'route.provider.read',
      evidenceType: 'provider_receipt',
      authBinding: 'SERVER_SIDE' as const,
    }, {
      providerId: 'provider-unverified',
      status: 'UNVERIFIED' as const,
      operations: ['READ'],
      routeId: 'route.provider.read',
      evidenceType: 'provider_receipt',
      authBinding: 'SERVER_SIDE' as const,
    }];

    expect(selectProviderCapability(providers, 'provider-live', 'READ')?.providerId)
      .toBe('provider-live');
    expect(selectProviderCapability(providers, 'provider-unverified', 'READ'))
      .toBeUndefined();
  });

  it('refuses canonical world commit without verified evidence', () => {
    expect(buildCanonicalWorldEvent({
      sequence: 1,
      logicalTime: 'E1:T1:S1',
      actorId: 'agent-1',
      missionId: 'mission-1',
      action: 'READ',
      target: 'provider-1',
      decisionVerdict: 'ALLOW',
      decisionHash: 'decision-hash',
      executionId: 'execution-1',
      providerId: 'provider-1',
      resultDigest: 'result-digest',
      evidenceHash: '',
      beforeStateHash: 'before',
      afterStateHash: 'after',
    })).toEqual({
      ok: false,
      reason: 'WORLD_COMMIT_EVIDENCE_REQUIRED',
    });
  });

  it('accepts canonical world commit only with ALLOW + provider result + evidence', () => {
    const result = buildCanonicalWorldEvent({
      sequence: 2,
      logicalTime: 'E1:T1:S2',
      actorId: 'agent-1',
      missionId: 'mission-1',
      action: 'READ',
      target: 'provider-1',
      decisionVerdict: 'ALLOW',
      decisionHash: 'decision-hash',
      executionId: 'execution-1',
      providerId: 'provider-1',
      resultDigest: 'result-digest',
      evidenceHash: 'evidence-hash',
      beforeStateHash: 'before',
      afterStateHash: 'after',
    });

    expect(result.ok).toBe(true);
  });
});
