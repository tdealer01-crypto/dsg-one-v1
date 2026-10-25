import { describe, expect, it } from 'vitest';
import {
  evaluateReviewerPreflight, REVIEW_PURPOSE, type ReviewerPreflightInput,
} from '@/lib/dsg/server/reviewer-preflight';

const WORKSPACE = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const NOW = Date.parse('2026-10-24T14:00:00Z');

function fixture(): ReviewerPreflightInput {
  return {
    actorId: 'supabase-actor-a', email: 'reviewer@example.test', emailConfirmed: true,
    workspaceId: WORKSPACE, expectedIssuer: 'https://auth.example.test/',
    expectedClient: 'client-verified', now: NOW,
    memberships: [{ actor_id: 'supabase-actor-a', workspace_id: WORKSPACE, role: 'AUDITOR' }],
    invitations: [{
      email: 'reviewer@example.test', workspace_id: WORKSPACE, purpose: REVIEW_PURPOSE,
      role: 'AUDITOR', status: 'active', expires_at: '2026-10-25T14:00:00Z',
    }],
    links: [{
      actor_id: 'supabase-actor-a', auth0_sub: 'auth0|reviewer',
      auth0_issuer: 'https://auth.example.test/', auth0_client_id: 'client-verified',
      verified_at: '2026-10-24T13:00:00Z',
    }],
    workspaces: [{ id: WORKSPACE, metadata: { purpose: REVIEW_PURPOSE } }],
  };
}

describe('ChatGPT reviewer preflight never grants execution', () => {
  it('marks only setup preflight eligible, with execution and resources still blocked', () => {
    const result = evaluateReviewerPreflight(fixture());
    expect(result.status).toBe('PREFLIGHT_ELIGIBLE');
    expect(result.executionEnabled).toBe(false);
    expect(result.productionAccessGranted).toBe(false);
    expect(result.resourceIsolationE2E).toBe('NOT_VERIFIED');
    expect(result.chatgptOAuthSessionE2E).toBe('NOT_VERIFIED');
  });
  it('requires a confirmed real DSG identity', () => {
    expect(evaluateReviewerPreflight({ ...fixture(), emailConfirmed: false }).reason)
      .toBe('REVIEWER_VERIFIED_IDENTITY_REQUIRED');
  });
  it('rejects missing, Owner, and cross-workspace membership', () => {
    const base = fixture();
    expect(evaluateReviewerPreflight({ ...base, memberships: [] }).status).toBe('BLOCKED');
    expect(evaluateReviewerPreflight({
      ...base, memberships: [{ actor_id: base.actorId, workspace_id: WORKSPACE, role: 'OWNER' }],
    }).status).toBe('BLOCKED');
    expect(evaluateReviewerPreflight({
      ...base, memberships: [{ actor_id: base.actorId, workspace_id: OTHER, role: 'AUDITOR' }],
    }).status).toBe('BLOCKED');
  });
  it('does not accept a Stripe reviewer invitation for ChatGPT testing', () => {
    const base = fixture();
    base.invitations[0].purpose = 'stripe_marketplace_review';
    expect(evaluateReviewerPreflight(base).reason).toBe('REVIEWER_INVITE_REQUIRED');
  });
  it('rejects expired, revoked, cross-workspace and duplicate invitations', () => {
    const base = fixture();
    for (const change of [
      { expires_at: '2026-10-23T00:00:00Z' },
      { expires_at: null },
      { status: 'revoked' },
      { workspace_id: OTHER },
    ]) {
      const request = { ...base, invitations: [{ ...base.invitations[0], ...change }] };
      expect(evaluateReviewerPreflight(request).status).toBe('BLOCKED');
    }
    expect(evaluateReviewerPreflight({
      ...base, invitations: [base.invitations[0], base.invitations[0]],
    }).status).toBe('BLOCKED');
  });
  it('rejects links to another actor, issuer, client, or duplicate Auth0 subject', () => {
    const base = fixture();
    for (const change of [
      { actor_id: 'another-actor' },
      { auth0_issuer: 'https://wrong.example.test/' },
      { auth0_client_id: 'untrusted-client' },
      { verified_at: 'not-a-date' },
    ]) {
      const request = { ...base, links: [{ ...base.links[0], ...change }] };
      expect(evaluateReviewerPreflight(request).reason).toBe('REVIEWER_AUTH0_ACCOUNT_LINK_REQUIRED');
    }
    expect(evaluateReviewerPreflight({ ...base, links: [base.links[0], base.links[0]] }).status)
      .toBe('BLOCKED');
  });
  it('does not treat an Owner workspace label as proof of a sandbox', () => {
    const base = fixture();
    expect(evaluateReviewerPreflight({
      ...base, workspaces: [{ id: WORKSPACE, metadata: {} }],
    }).status).toBe('BLOCKED');
    expect(evaluateReviewerPreflight({
      ...base, workspaces: [{ id: OTHER, metadata: { purpose: REVIEW_PURPOSE } }],
    }).status).toBe('BLOCKED');
  });
});
