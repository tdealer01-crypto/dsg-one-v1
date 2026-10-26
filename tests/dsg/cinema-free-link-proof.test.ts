import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  'app/api/dsg/cinema/free-link-proof/route.ts', 'utf8'
);

describe('Cinema Free account link signer contract', () => {
  it('reuses the existing Auth0 user verifier with exact user scope', () => {
    expect(source).toContain("verifyDsgAuth0Principal(accessToken, 'dsg.use')");
    expect(source).toContain('DSG_AUTH0_CLIENT_ID');
    expect(source).toContain('DSG_AUTH0_ISSUER');
  });

  it('requires current website actor, permission, unique identity link and membership', () => {
    expect(source).toContain('resolveVerifiedDsgActor(request.headers)');
    expect(source).toContain("'job:control'");
    expect(source).toContain("'dsg_auth0_identity_links'");
    expect(source).toContain("actor_id: 'eq.' + actor.actorId");
    expect(source).toContain("auth0_sub: 'eq.' + principal.subject");
    expect(source).toContain('links.length !== 1');
    expect(source).toContain('reverse.length !== 1');
  });

  it('never puts OAuth tokens, actor IDs or signing secret in URLs', () => {
    expect(source).toContain("request.headers.get('origin') !== EXPECTED_ORIGIN");
    expect(source).toContain('DSG_CINEMA_SITE_ASSERTION_PRIVATE_KEY_B64');
    expect(source).toContain("Buffer.byteLength(raw, 'utf8')");
    expect(source).toContain("'Cache-Control': 'no-store'");
  });

  it('issues narrow, expiring, unique, signed proof — not a browser permit', () => {
    expect(source).toContain("SITE_ROUTE = 'cinema.account.link'");
    expect(source).toContain(".setProtectedHeader({ alg: 'EdDSA', typ: 'JWT' })");
    expect(source).toContain('.setNotBefore(now)');
    expect(source).toContain('.setExpirationTime(now + 45)');
    expect(source).toContain('.setJti(randomBytes(24)');
    expect(source).toContain('grantsBrowserExecution: false');
  });
});
