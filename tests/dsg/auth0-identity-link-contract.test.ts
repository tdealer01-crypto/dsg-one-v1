import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const route = readFileSync(join(root, 'app/api/dsg/identity/link/route.ts'), 'utf8');
const verifier = readFileSync(join(root, 'lib/dsg/server/auth0-identity.ts'), 'utf8');
const migration = readFileSync(join(root, 'ops/auth0/dsg_auth0_identity_links.sql'), 'utf8');
const bridge = readFileSync(join(root, 'app/dsg/autonomous-level/identity-bridge.tsx'), 'utf8');

describe('DSG Auth0 account binding safety contract', () => {
  it('requires verified DSG workspace membership and signed Auth0 principal', () => {
    expect(route).toContain('resolveVerifiedDsgActor(request.headers)');
    expect(route).toContain('verifyDsgAuth0Principal(data?.accessToken)');
    expect(verifier).toContain('jwtVerify(token, jwks,');
    expect(verifier).toContain('payload.azp !== DSG_AUTH0_CLIENT_ID');
    expect(verifier).toContain("payload.scope.split(' ').includes('dsg.use')");
  });

  it('rejects origin mismatch and never grants N2N approval from linking', () => {
    expect(route).toContain("request.headers.get('origin') !== 'https://dsg.pics'");
    expect(route).toContain('n2nApprovalGranted: false');
    expect(route).toContain('ACTOR_ALREADY_LINKED_TO_DIFFERENT_IDENTITY');
  });

  it('stores mapping under service-role only with uniqueness and RLS', () => {
    expect(route).toContain('DSG_IDENTITY_SERVICE_ROLE_REQUIRED');
    expect(migration).toContain('auth0_sub text not null unique');
    expect(migration).toContain('force row level security');
    expect(migration).toContain('revoke all on table');
  });

  it('preserves existing DSG login and never exposes a privileged token in source', () => {
    expect(bridge).toContain('createAuth0Client');
    expect(bridge).toContain('loginWithRedirect');
    expect(bridge).toContain("cacheLocation: 'memory'");
    expect(bridge).not.toContain('localStorage.setItem');
    expect(bridge).not.toContain('client_secret');
  });
});
