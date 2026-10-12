import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jwtVerify } from 'jose';
import {
  DSG_AUTH0_CLIENT_ID,
  DSG_AUTH0_APPROVER_CLIENT_ID,
  verifyDsgAuth0Principal,
} from '@/lib/dsg/server/auth0-identity';

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => () => undefined),
  jwtVerify: vi.fn(),
}));

const token = 'opaque-' + 'x'.repeat(110); // Synthetic fixture: never a real credential.

function verifiedClaims(clientId: string, scope: string) {
  const now = Math.floor(Date.now() / 1000);
  vi.mocked(jwtVerify).mockResolvedValue({
    payload: {
      iss: 'https://dev-kcddqmnusbxxo25s.us.auth0.com/',
      aud: 'https://aws.dsg.pics',
      sub: 'auth0|same-human',
      azp: clientId,
      scope,
      iat: now,
      exp: now + 120,
    },
  } as never);
}

describe('separate Auth0 agents and human approver', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('preserves agent authentication on the existing linked DSG website SPA', async () => {
    verifiedClaims(DSG_AUTH0_CLIENT_ID, 'openid profile dsg.use');
    const verified = await verifyDsgAuth0Principal(token, 'dsg.use');
    expect(verified?.clientId).toBe(DSG_AUTH0_CLIENT_ID);
    expect(verified?.scope).toBe('dsg.use');
  });

  it('accepts only the new signed client for a human approval token', async () => {
    verifiedClaims(DSG_AUTH0_APPROVER_CLIENT_ID, 'openid profile dsg.approve');
    const verified = await verifyDsgAuth0Principal(token, 'dsg.approve');
    expect(verified?.subject).toBe('auth0|same-human');
    expect(verified?.clientId).toBe(DSG_AUTH0_APPROVER_CLIENT_ID);
    expect(verified?.scope).toBe('dsg.approve');
  });

  it('rejects attempts to use old shared website SPA for human approval', async () => {
    verifiedClaims(DSG_AUTH0_CLIENT_ID, 'openid dsg.approve');
    expect(await verifyDsgAuth0Principal(token, 'dsg.approve')).toBeNull();
  });

  it('rejects new approver SPA for agent operations, even with dsg.use scope', async () => {
    verifiedClaims(DSG_AUTH0_APPROVER_CLIENT_ID, 'openid dsg.use dsg.approve');
    expect(await verifyDsgAuth0Principal(token, 'dsg.use')).toBeNull();
  });

  it('rejects approved client without exact dsg.approve scope', async () => {
    verifiedClaims(DSG_AUTH0_APPROVER_CLIENT_ID, 'openid profile');
    expect(await verifyDsgAuth0Principal(token, 'dsg.approve')).toBeNull();
  });

  it('does not use an unrecognized Auth0 azp as a fallback', async () => {
    verifiedClaims('unknown-oauth-client', 'openid dsg.use dsg.approve');
    expect(await verifyDsgAuth0Principal(token, 'dsg.use')).toBeNull();
    expect(await verifyDsgAuth0Principal(token, 'dsg.approve')).toBeNull();
  });
});
