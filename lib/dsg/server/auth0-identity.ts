import { createRemoteJWKSet, jwtVerify } from 'jose';

export const DSG_AUTH0_ISSUER = 'https://dev-kcddqmnusbxxo25s.us.auth0.com/';
export const DSG_AUTH0_AUDIENCE = 'https://aws.dsg.pics';
export const DSG_AUTH0_CLIENT_ID = 'mLIAcMEAhuVDaUvzXn8Qo54zj2llFp3X';
// Separate Auth0 SPA for human decision authority; NEVER an agent client.
export const DSG_AUTH0_APPROVER_CLIENT_ID = 'jI1uiKcQu7mqORsaCrogKTQVsAcZuQSt';

const jwks = createRemoteJWKSet(new URL('.well-known/jwks.json', DSG_AUTH0_ISSUER), {
  timeoutDuration: 5000,
});

export type VerifiedAuth0Principal = {
  subject: string;
  issuer: string;
  clientId: string;
  scope: 'dsg.use' | 'dsg.approve';
  hasApprovalScope?: boolean;
};

export async function verifyDsgAuth0Principal(token: unknown, requiredScope: 'dsg.use' | 'dsg.approve' = 'dsg.use'): Promise<VerifiedAuth0Principal | null> {
  if (typeof token !== 'string' || token.length < 100 || token.length > 15000) return null;
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: DSG_AUTH0_ISSUER,
      audience: DSG_AUTH0_AUDIENCE,
      algorithms: ['RS256'],
      clockTolerance: 5,
    });
    if (typeof payload.sub !== 'string' || payload.sub.length === 0 || payload.sub.length > 256) return null;
    // Audience alone is not sufficient when multiple websites share the same Auth0 tenant.
    // Distinct signed OAuth client identities by scope. The human approver
    // must never authenticate through the shared DSG agent/website client.
    const expectedClientId = requiredScope === 'dsg.approve'
      ? DSG_AUTH0_APPROVER_CLIENT_ID : DSG_AUTH0_CLIENT_ID;
    if (payload.azp !== expectedClientId) return null;
    if (!payload.exp || !payload.iat || payload.iat > Date.now() / 1000 + 5) return null;
    if (typeof payload.scope !== 'string') return null;
    if (requiredScope === 'dsg.use' && !payload.scope.split(' ').includes('dsg.use')) return null;
    if (requiredScope === 'dsg.approve' && !payload.scope.split(' ').includes('dsg.approve')) return null;
    return { subject: payload.sub, issuer: DSG_AUTH0_ISSUER, clientId: expectedClientId, scope: requiredScope, hasApprovalScope: payload.scope.split(' ').includes('dsg.approve') };
  } catch {
    return null;
  }
}
