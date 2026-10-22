import { NextRequest, NextResponse } from 'next/server';
import { createPrivateKey, randomBytes } from 'node:crypto';
import { SignJWT } from 'jose';
import { assertDsgPermission, resolveVerifiedDsgActor } from '@/lib/dsg/server/context';
import { getDsgSupabaseRpcConfig, readDsgRest } from '@/lib/dsg/server/supabase-rpc';
import { verifyDsgAuth0Principal, DSG_AUTH0_CLIENT_ID, DSG_AUTH0_ISSUER } from '@/lib/dsg/server/auth0-identity';

// Cinema only trusts a dedicated, short-lived signed proof from the *website*
// after fresh Auth0 signature verification, actor identity binding, and
// workspace membership/permissions. No browser-supplied actor ID is trusted.
// This is NOT a login cookie, account provisioning or a browser execute permit.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const EXPECTED_ORIGIN = 'https://dsg.pics';
const SITE_ISSUER = 'urn:dsg:one:verified-site-actor';
const SITE_AUDIENCE = 'urn:dsg:cinema:free-account-link';
const SITE_ROUTE = 'cinema.account.link';
const MAX_JSON_BYTES = 16_000;

type IdentityLink = {
  actor_id: string;
  auth0_sub: string;
  auth0_issuer: string;
  auth0_client_id: string;
};

function reply(status: number, data: Record<string, unknown>) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function signerKey() {
  // Owner provisions this server-side only; no default, no shared client key.
  const source = process.env.DSG_CINEMA_SITE_ASSERTION_PRIVATE_KEY_B64?.trim() ?? '';
  if (!/^[A-Za-z0-9+/]{43}=$/.test(source)) throw new Error('SITE_PROOF_SIGNER_UNCONFIGURED');
  const seed = Buffer.from(source, 'base64');
  if (seed.length !== 32 || seed.toString('base64') !== source) {
    throw new Error('SITE_PROOF_SIGNER_UNCONFIGURED');
  }
  // PKCS#8 Ed25519 DER header with a private 32-byte seed.
  const der = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]);
  seed.fill(0);
  return createPrivateKey({ key: der, type: 'pkcs8', format: 'der' });
}

function serviceConfig() {
  const serviceRole = process.env.DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRole || (serviceRole.startsWith('sb_') && !serviceRole.startsWith('sb_secret_'))) {
    throw new Error('DSG_IDENTITY_SERVICE_ROLE_REQUIRED');
  }
  const config = getDsgSupabaseRpcConfig();
  if (config.key !== serviceRole) throw new Error('DSG_IDENTITY_SERVICE_ROLE_REQUIRED');
  return config;
}

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== EXPECTED_ORIGIN) return reply(403, { ok: false, error: 'ORIGIN_DENIED' });
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return reply(415, { ok: false, error: 'JSON_REQUIRED' });
  }
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (!Number.isFinite(contentLength) || contentLength > MAX_JSON_BYTES) {
    return reply(413, { ok: false, error: 'PAYLOAD_TOO_LARGE' });
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_JSON_BYTES) return reply(413, { ok: false, error: 'PAYLOAD_TOO_LARGE' });
    body = JSON.parse(raw);
  } catch {
    return reply(400, { ok: false, error: 'INVALID_JSON' });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400, { ok: false, error: 'INVALID_BODY' });
  const accessToken = (body as Record<string, unknown>).accessToken;
  const principal = await verifyDsgAuth0Principal(accessToken, 'dsg.use');
  if (!principal) return reply(401, { ok: false, error: 'AUTH0_USER_TOKEN_INVALID' });

  try {
    const actor = assertDsgPermission(await resolveVerifiedDsgActor(request.headers), 'job:control');
    // All website actor membership and Auth0 identity checks must be current,
    // not arbitrary client-supplied role/workspace/subject strings.
    const links = await readDsgRest<IdentityLink[]>(
      serviceConfig(), 'dsg_auth0_identity_links', {
        actor_id: 'eq.' + actor.actorId,
        select: 'actor_id,auth0_sub,auth0_issuer,auth0_client_id',
        limit: '2',
      }, { timeoutMs: 5000 },
    );
    if (links.length !== 1 || links[0].actor_id !== actor.actorId ||
        links[0].auth0_sub !== principal.subject ||
        links[0].auth0_issuer !== DSG_AUTH0_ISSUER ||
        links[0].auth0_client_id !== DSG_AUTH0_CLIENT_ID) {
      return reply(403, { ok: false, error: 'DSG_SITE_ACTOR_AUTH0_LINK_INVALID' });
    }
    // Verify there is no competing actor for the very same Auth0 subject.
    const reverse = await readDsgRest<IdentityLink[]>(
      serviceConfig(), 'dsg_auth0_identity_links', {
        auth0_sub: 'eq.' + principal.subject,
        select: 'actor_id,auth0_sub,auth0_issuer,auth0_client_id',
        limit: '2',
      }, { timeoutMs: 5000 },
    );
    if (reverse.length !== 1 || reverse[0].actor_id !== actor.actorId) {
      return reply(409, { ok: false, error: 'AUTH0_SUBJECT_AMBIGUOUS' });
    }

    const key = signerKey();
    const now = Math.floor(Date.now() / 1000);
    const signed = await new SignJWT({
      route_id: SITE_ROUTE,
      auth0_iss: DSG_AUTH0_ISSUER,
      auth0_client_id: DSG_AUTH0_CLIENT_ID,
      actor_id: actor.actorId,
      workspace_id: actor.workspaceId,
      role: actor.role,
      membership_verified: true,
    })
      .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT' })
      .setIssuer(SITE_ISSUER)
      .setAudience(SITE_AUDIENCE)
      .setSubject(principal.subject)
      .setIssuedAt(now)
      .setNotBefore(now)
      .setExpirationTime(now + 45)
      .setJti(randomBytes(24).toString('base64url'))
      .sign(key);
    return reply(200, { ok: true, assertion: signed, expiresInSeconds: 45,
      route: SITE_ROUTE, grantsCinemaAccess: false, grantsBrowserExecution: false });
  } catch {
    return reply(503, { ok: false, error: 'SITE_MEMBERSHIP_OR_SIGNER_UNAVAILABLE' });
  }
}
