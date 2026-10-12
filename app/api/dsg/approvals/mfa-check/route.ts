import { NextRequest, NextResponse } from 'next/server';
import { resolveVerifiedDsgActor } from '@/lib/dsg/server/context';
import {
  verifyDsgAuth0Principal, DSG_AUTH0_ISSUER, DSG_AUTH0_CLIENT_ID,
} from '@/lib/dsg/server/auth0-identity';
import { getDsgSupabaseRpcConfig, readDsgRest } from '@/lib/dsg/server/supabase-rpc';

export const dynamic = 'force-dynamic';

// Read-only, user-initiated proof probe. NEVER calls an AWS tool,
// grants approval, writes a permit, or returns a bearer token.
const MAX_BODY_BYTES = 16_000;
type IdentityLink = {
  actor_id: string; auth0_sub: string; auth0_issuer: string; auth0_client_id: string;
};
const respond = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

async function boundedPayload(request: NextRequest): Promise<{ accessToken?: unknown }> {
  const len = Number(request.headers.get('content-length') ?? '0');
  if (!Number.isFinite(len) || len < 0 || len > MAX_BODY_BYTES) throw Error('REQUEST_SIZE');
  const reader = request.body?.getReader();
  if (!reader) throw Error('NO_BODY');
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > MAX_BODY_BYTES) throw Error('REQUEST_SIZE');
      chunks.push(next.value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  const data: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true })
    .decode(Buffer.concat(chunks)));
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('OBJECT_REQUIRED');
  return data as { accessToken?: unknown };
}

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== 'https://dsg.pics')
    return respond(403, { ok: false, error: 'ORIGIN_DENIED' });
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return respond(415, { ok: false, error: 'JSON_REQUIRED' });

  let actor;
  try {
    actor = await resolveVerifiedDsgActor(request.headers);
  } catch {
    return respond(401, { ok: false, error: 'DSG_SITE_IDENTITY_NOT_VERIFIED' });
  }
  if (!actor) return respond(401, { ok: false, error: 'DSG_SITE_IDENTITY_NOT_VERIFIED' });

  let input;
  try { input = await boundedPayload(request); }
  catch { return respond(400, { ok: false, error: 'INVALID_OR_OVERSIZED_JSON' }); }

  // Scope- and azp-restricted RS256/JWKS verification. No API fallback.
  const verified = await verifyDsgAuth0Principal(input.accessToken, 'dsg.approve');
  if (!verified) return respond(401, { ok: false, error: 'APPROVER_JWT_INVALID' });

  // Preserve current DSG website identity link to the original non-approver
  // client, matching only the subject (not the two deliberately distinct azp).
  try {
    const serviceKey = process.env.DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY ??
      process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) return respond(503, { ok: false, error: 'IDENTITY_LINK_STORE_UNAVAILABLE' });
    const config = getDsgSupabaseRpcConfig();
    if (config.key !== serviceKey)
      return respond(503, { ok: false, error: 'IDENTITY_LINK_STORE_UNAVAILABLE' });
    const matches = await readDsgRest<IdentityLink[]>(config, 'dsg_auth0_identity_links', {
      actor_id: 'eq.' + actor.actorId,
      select: 'actor_id,auth0_sub,auth0_issuer,auth0_client_id',
      limit: '1',
    });
    const linked = matches[0];
    if (!linked || linked.actor_id !== actor.actorId ||
        linked.auth0_issuer !== DSG_AUTH0_ISSUER ||
        linked.auth0_client_id !== DSG_AUTH0_CLIENT_ID ||
        linked.auth0_sub !== verified.subject) {
      return respond(403, { ok: false, error: 'SITE_AUTH0_SUBJECT_BINDING_MISMATCH' });
    }
  } catch {
    return respond(503, { ok: false, error: 'IDENTITY_LINK_STORE_UNAVAILABLE' });
  }

  if (verified.mfaProofVerified !== true)
    return respond(403, { ok: false, mfaVerified: false, error: 'FRESH_SIGNED_MFA_REQUIRED' });

  // One boolean proof only; no JWT, claims payload, or one-use approval.
  return respond(200, { ok: true, mfaVerified: true, authorizedClientVerified: true });
}
