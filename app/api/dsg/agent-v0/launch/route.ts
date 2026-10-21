import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedDsgActor } from '@/lib/dsg/server/context';
import { verifyDsgAuth0Principal, DSG_AUTH0_CLIENT_ID, DSG_AUTH0_ISSUER } from '@/lib/dsg/server/auth0-identity';
import { getDsgSupabaseRpcConfig, readDsgRest } from '@/lib/dsg/server/supabase-rpc';
import { callKaggleOwnerBridge } from '@/lib/dsg/server/kaggle-owner-ssm-bridge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const MAX_JSON_BYTES = 16_000;
type LinkRow = { actor_id: string; auth0_sub: string; auth0_issuer: string; auth0_client_id: string };

function reply(status: number, data: Record<string, unknown>) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
async function boundedBody(request: NextRequest) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw Error('JSON_REQUIRED');
  const length = Number(request.headers.get('content-length') ?? '0');
  if (!Number.isSafeInteger(length) || length < 0 || length > MAX_JSON_BYTES) throw Error('BODY_TOO_LARGE');
  const reader = request.body?.getReader();
  if (!reader) throw Error('BODY_REQUIRED');
  let used = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      used += next.value.byteLength;
      if (used > MAX_JSON_BYTES) throw Error('BODY_TOO_LARGE');
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('BODY_INVALID');
  return parsed as Record<string, unknown>;
}
async function linkedSubject(actorId: string) {
  const serviceKey = process.env.DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw Error('KAGGLE_SITE_IDENTITY_BINDING_UNAVAILABLE');
  const config = getDsgSupabaseRpcConfig();
  if (config.key !== serviceKey) throw Error('KAGGLE_SITE_IDENTITY_BINDING_UNAVAILABLE');
  const rows = await readDsgRest<LinkRow[]>(config, 'dsg_auth0_identity_links', {
    actor_id: 'eq.' + actorId,
    select: 'actor_id,auth0_sub,auth0_issuer,auth0_client_id',
    limit: '1',
  });
  const link = rows[0];
  if (!link || link.actor_id !== actorId ||
      link.auth0_issuer !== DSG_AUTH0_ISSUER || link.auth0_client_id !== DSG_AUTH0_CLIENT_ID) {
    throw Error('KAGGLE_OWNER_AUTH0_LINK_REQUIRED');
  }
  return link.auth0_sub;
}


export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== 'https://dsg.pics') {
    return reply(403, { ok: false, error: 'ORIGIN_DENIED' });
  }
  let actor;
  try {
    actor = await requireVerifiedDsgActor(request.headers, 'job:control');
    if (actor.role !== 'OWNER') return reply(403, { ok: false, error: 'KAGGLE_OWNER_REQUIRED' });
  } catch {
    return reply(401, { ok: false, error: 'KAGGLE_VERIFIED_OWNER_SESSION_REQUIRED' });
  }
  let input: Record<string, unknown>;
  try { input = await boundedBody(request); }
  catch { return reply(400, { ok: false, error: 'KAGGLE_INVALID_OWNER_REQUEST' }); }
  if (input.action !== 'start_free_gpu' ||
      Object.keys(input).some(key => !['action', 'accessToken'].includes(key))) {
    return reply(400, { ok: false, error: 'KAGGLE_START_SCOPE_INVALID' });
  }
  const verified = await verifyDsgAuth0Principal(input.accessToken, 'dsg.use');
  if (!verified || verified.hasApprovalScope) {
    return reply(401, { ok: false, error: 'KAGGLE_SIGNED_AUTH0_USER_REQUIRED' });
  }
  try {
    if (verified.subject !== await linkedSubject(actor.actorId)) {
      return reply(403, { ok: false, error: 'KAGGLE_OWNER_SUBJECT_MISMATCH' });
    }
  } catch {
    return reply(403, { ok: false, error: 'KAGGLE_OWNER_IDENTITY_LINK_UNVERIFIED' });
  }

  // The Python bridge reads only /dsg/one/prod/kaggle-owner-dispatch-token
  // from SSM SecureString via EC2 IAM, and NEVER sends the token to Node.
  // Its exact GitHub /user owner gate, run lock and free-only existing
  // workflow checks still apply. No shell, user-selected workflow or paid GPU.
  const outcome = await callKaggleOwnerBridge('launch');
  if (!outcome.ok) {
    const code = outcome.error;
    const status = code === 'KAGGLE_OWNER_DISPATCH_LOCKED' ||
      code === 'KAGGLE_GPU_JOB_ALREADY_IN_PROGRESS' ? 409 :
      code === 'KAGGLE_RECENT_LAUNCH_COOLDOWN' ? 429 : 503;
    return reply(status, { ok: false, error: code ?? 'KAGGLE_OWNER_BRIDGE_UNAVAILABLE', gpuState: 'UNVERIFIED' });
  }
  return reply(202, {
    ok: true, status: 'OWNER_DISPATCH_ACCEPTED', gpuState: 'UNVERIFIED',
    details: 'Existing owner Kaggle workflow will verify free GPU quota and worker readiness.',
  });
}
