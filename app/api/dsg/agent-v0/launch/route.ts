import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedDsgActor } from '@/lib/dsg/server/context';
import { verifyDsgAuth0Principal, DSG_AUTH0_CLIENT_ID, DSG_AUTH0_ISSUER } from '@/lib/dsg/server/auth0-identity';
import { getDsgSupabaseRpcConfig, readDsgRest } from '@/lib/dsg/server/supabase-rpc';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OWNER = 'tdealer01-crypto';
const REPO = 'DSG-Private-Production-Runtime';
const WORKFLOW = 'launch-kaggle-brain-oidc.yml';
const API = 'https://api.github.com/repos/' + OWNER + '/' + REPO;
const MAX_JSON_BYTES = 16_000;
const COOLDOWN_MS = 10 * 60 * 1000;

type LinkRow = { actor_id: string; auth0_sub: string; auth0_issuer: string; auth0_client_id: string };
type GitHubRun = { id?: unknown; status?: unknown; created_at?: unknown };
type RunList = { workflow_runs?: GitHubRun[] };
type Whoami = { login?: unknown };

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

async function githubJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    signal: AbortSignal.timeout(8_000),
    cache: 'no-store',
  });
  if (!response.ok) throw Error('KAGGLE_GITHUB_CONTROL_UNAVAILABLE');
  return response.json() as Promise<T>;
}

// Exact site-owner + linked Auth0 subject + owner-scoped GitHub identity.
// This action authorizes one free-only, bounded Kaggle launch workflow.
// It never calls Kaggle directly, bypasses Spacetime action approval,
// or grants Agent v0 permission to execute providers.
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
  const token = process.env.DSG_KAGGLE_OWNER_DISPATCH_TOKEN;
  if (!token) return reply(503, { ok: false, error: 'KAGGLE_OWNER_DISPATCH_NOT_CONFIGURED' });

  try {
    const user = await githubJson<Whoami>('https://api.github.com/user', token);
    // The existing owner-only workflow intentionally denies bot/service
    // identities. Never weaken that gate or use a token from another account.
    if (user.login !== OWNER) {
      return reply(403, { ok: false, error: 'KAGGLE_GITHUB_OWNER_IDENTITY_MISMATCH' });
    }
    const current = await githubJson<RunList>(
      API + '/actions/workflows/' + WORKFLOW + '/runs?event=workflow_dispatch&per_page=8', token);
    if (!Array.isArray(current.workflow_runs)) throw Error('KAGGLE_RUN_LIST_INVALID');
    const now = Date.now();
    for (const run of current.workflow_runs) {
      const state = run.status;
      if (['queued', 'waiting', 'pending', 'requested', 'in_progress'].includes(String(state))) {
        return reply(409, { ok: false, error: 'KAGGLE_LAUNCH_ALREADY_IN_PROGRESS' });
      }
      const created = typeof run.created_at === 'string' ? Date.parse(run.created_at) : NaN;
      if (Number.isFinite(created) && created <= now && now - created < COOLDOWN_MS) {
        return reply(429, { ok: false, error: 'KAGGLE_RECENT_OWNER_LAUNCH_COOLDOWN' });
      }
    }
    const response = await fetch(API + '/actions/workflows/' + WORKFLOW + '/dispatches', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: { confirm: 'LAUNCH_DSG_KAGGLE_BRAIN', execution_runner: 'github-hosted' },
      }),
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    });
    if (response.status !== 204) {
      return reply(502, { ok: false, error: 'KAGGLE_OWNER_WORKFLOW_DISPATCH_REJECTED' });
    }
    return reply(202, {
      ok: true,
      status: 'OWNER_DISPATCH_ACCEPTED',
      gpuState: 'UNVERIFIED',
      details: 'Quota and kernel startup must pass the private Kaggle workflow; no GPU-ready claim.',
    });
  } catch {
    return reply(503, { ok: false, error: 'KAGGLE_OWNER_DISPATCH_UNAVAILABLE' });
  }
}
