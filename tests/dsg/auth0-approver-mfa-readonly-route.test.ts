import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { verifyDsgAuth0Principal } from '@/lib/dsg/server/auth0-identity';
import { POST } from '../../app/api/dsg/approvals/mfa-check/route';

vi.mock('@/lib/dsg/server/auth0-identity', () => ({
  verifyDsgAuth0Principal: vi.fn(),
}));

const verify = vi.mocked(verifyDsgAuth0Principal);
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
    verify.mockResolvedValue({
      subject, issuer, clientId: 'jI1uiKcQu7mqORsaCrogKTQVsAcZuQSt',
      scope: 'dsg.approve', mfaProofVerified: true,
    });
  });

  it('does not process cross-origin access tokens', async () => {
    const res = await POST(request({ origin: 'https://evil.example' }));
    expect(res.status).toBe(403);
    expect(verify).not.toHaveBeenCalled();
  });

  it('accepts fresh signed human MFA without requiring Supabase website login', async () => {
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true, mfaVerified: true, authorizedClientVerified: true,
    });
    expect(verify).toHaveBeenCalledWith('synthetic-placeholder-token', 'dsg.approve');
  });

  it('rejects wrong or missing approval token without provider fallback', async () => {
    verify.mockResolvedValue(null);
    const res = await POST(request());
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('APPROVER_JWT_INVALID');
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
