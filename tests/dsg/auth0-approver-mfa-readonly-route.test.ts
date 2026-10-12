import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { resolveVerifiedDsgActor } from '@/lib/dsg/server/context';
import { verifyDsgAuth0Principal } from '@/lib/dsg/server/auth0-identity';
import { getDsgSupabaseRpcConfig, readDsgRest } from '@/lib/dsg/server/supabase-rpc';
import { POST } from '../../app/api/dsg/approvals/mfa-check/route';

vi.mock('@/lib/dsg/server/context', () => ({ resolveVerifiedDsgActor: vi.fn() }));
vi.mock('@/lib/dsg/server/auth0-identity', () => ({
  DSG_AUTH0_ISSUER: 'https://dev-kcddqmnusbxxo25s.us.auth0.com/',
  DSG_AUTH0_CLIENT_ID: 'mLIAcMEAhuVDaUvzXn8Qo54zj2llFp3X',
  verifyDsgAuth0Principal: vi.fn(),
}));
vi.mock('@/lib/dsg/server/supabase-rpc', () => ({
  getDsgSupabaseRpcConfig: vi.fn(), readDsgRest: vi.fn(),
}));

const actor = vi.mocked(resolveVerifiedDsgActor);
const verify = vi.mocked(verifyDsgAuth0Principal);
const config = vi.mocked(getDsgSupabaseRpcConfig);
const links = vi.mocked(readDsgRest);
const subject = 'auth0|correct-owner';
const issuer = 'https://dev-kcddqmnusbxxo25s.us.auth0.com/';

function request(options: { origin?: string; token?: string } = {}) {
  return new NextRequest('https://dsg.pics/api/dsg/approvals/mfa-check', {
    method: 'POST',
    headers: { origin: options.origin ?? 'https://dsg.pics', 'content-type': 'application/json' },
    body: JSON.stringify({ accessToken: options.token ?? 'synthetic-placeholder-token' }),
  });
}

describe('read-only real human MFA verifier (never approves anything)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY', 'role-key-test');
    actor.mockResolvedValue({ actorId: 'actor-1', workspaceId: 'workspace-1', role: 'OWNER' });
    config.mockReturnValue({ key: 'role-key-test', url: 'https://test.supabase.co' } as never);
    verify.mockResolvedValue({
      subject, issuer, clientId: 'jI1uiKcQu7mqORsaCrogKTQVsAcZuQSt',
      scope: 'dsg.approve', mfaProofVerified: true,
    });
    links.mockResolvedValue([{
      actor_id: 'actor-1', auth0_sub: subject, auth0_issuer: issuer,
      auth0_client_id: 'mLIAcMEAhuVDaUvzXn8Qo54zj2llFp3X',
    }] as never);
  });

  it('does not process cross-origin access tokens', async () => {
    const res = await POST(request({ origin: 'https://evil.example' }));
    expect(res.status).toBe(403);
    expect(verify).not.toHaveBeenCalled();
  });

  it('requires the signed-in website actor', async () => {
    actor.mockResolvedValue(null);
    const res = await POST(request());
    expect(res.status).toBe(401);
    expect(verify).not.toHaveBeenCalled();
  });

  it('rejects wrong or missing approval token without provider fallback', async () => {
    verify.mockResolvedValue(null);
    const res = await POST(request());
    expect(res.status).toBe(401);
    expect(links).not.toHaveBeenCalled();
  });

  it('rejects missing signed fresh OTP proof', async () => {
    verify.mockResolvedValue({
      subject, issuer, clientId: 'jI1uiKcQu7mqORsaCrogKTQVsAcZuQSt',
      scope: 'dsg.approve', mfaProofVerified: false,
    });
    const res = await POST(request());
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('FRESH_SIGNED_MFA_REQUIRED');
  });

  it('rejects an unlinked or mismatched Auth0 subject', async () => {
    links.mockResolvedValue([{
      actor_id: 'actor-1', auth0_sub: 'auth0|someone-else', auth0_issuer: issuer,
      auth0_client_id: 'mLIAcMEAhuVDaUvzXn8Qo54zj2llFp3X',
    }] as never);
    const res = await POST(request());
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('SITE_AUTH0_SUBJECT_BINDING_MISMATCH');
  });

  it('returns only boolean proof; no bearer, approval or AWS call', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    try {
      const res = await POST(request());
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(data).toEqual({ ok: true, mfaVerified: true, authorizedClientVerified: true });
      expect(JSON.stringify(data)).not.toContain('synthetic-placeholder-token');
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
