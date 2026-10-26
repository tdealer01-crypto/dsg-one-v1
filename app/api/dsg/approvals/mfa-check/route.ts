import { NextRequest, NextResponse } from 'next/server';
import { verifyDsgAuth0Principal } from '@/lib/dsg/server/auth0-identity';

export const dynamic = 'force-dynamic';

// Read-only, user-initiated proof probe. NEVER calls an AWS tool,
// grants approval, writes a permit, or returns a bearer token.
const MAX_BODY_BYTES = 16_000;
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

  let input;
  try { input = await boundedPayload(request); }
  catch { return respond(400, { ok: false, error: 'INVALID_OR_OVERSIZED_JSON' }); }

  // Scope- and azp-restricted RS256/JWKS verification. No API fallback.
  const verified = await verifyDsgAuth0Principal(input.accessToken, 'dsg.approve');
  if (!verified) return respond(401, { ok: false, error: 'APPROVER_JWT_INVALID' });

  // A second Supabase site session must not be required to verify a fresh
  // Auth0 MFA proof. The JWT verifier pins signature, issuer, audience,
  // approver-only client ID and scope. This probe NEVER approves anything.

  if (verified.mfaProofVerified !== true)
    return respond(403, { ok: false, mfaVerified: false, error: 'FRESH_SIGNED_MFA_REQUIRED' });

  // One boolean proof only; no JWT, claims payload, or one-use approval.
  return respond(200, { ok: true, mfaVerified: true, authorizedClientVerified: true });
}
