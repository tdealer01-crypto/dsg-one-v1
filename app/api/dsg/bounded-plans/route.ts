import { NextRequest, NextResponse } from 'next/server';
import { assertDsgPermission, resolveVerifiedDsgActor } from '@/lib/dsg/server/context';
import { DSG_AUTH0_CLIENT_ID, DSG_AUTH0_ISSUER, verifyDsgAuth0Principal } from '@/lib/dsg/server/auth0-identity';
import { getDsgSupabaseRpcConfig, readDsgRest } from '@/lib/dsg/server/supabase-rpc';

export const dynamic = 'force-dynamic';

const UPSTREAM = 'https://aws.dsg.pics/owner/bounded-plans/';
const OPERATIONS = new Set(['stage', 'view', 'confirm', 'status', 'revoke']);
const ROUTES = new Set(['route.desktop-native.fs-write', 'route.cinema-remote.connect']);
const ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/;
const HASH = /^[a-f0-9]{64}$/;
const MAX_BODY = 128_000;
const MAX_RESPONSE = 256_000;
type Json = Record<string, unknown>;
type Operation = 'stage' | 'view' | 'confirm' | 'status' | 'revoke';

function object(value: unknown): value is Json {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function keys(value: Json, required: string[], optional: string[] = []): boolean {
  return required.every(key => Object.hasOwn(value, key)) &&
    Object.keys(value).every(key => required.includes(key) || optional.includes(key));
}
function id(value: unknown): value is string { return typeof value === 'string' && ID.test(value); }
function hash(value: unknown): value is string { return typeof value === 'string' && HASH.test(value); }
function text(value: unknown, max = 1024): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}
function integer(value: unknown): value is number { return Number.isSafeInteger(value) && (value as number) >= 0; }
function jsonContentType(headers: Headers): boolean {
  return headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() === 'application/json';
}

function blocked(status: number, error: string, nextAction = 'Review the existing request and its configuration before retrying.') {
  return NextResponse.json({ ok: false, status: 'BLOCKED', error, nextAction },
    { status, headers: { 'Cache-Control': 'no-store' } });
}
async function readJson(message: Pick<Request, 'body' | 'headers'>, limit: number): Promise<unknown> {
  const length = Number(message.headers.get('content-length') ?? 0);
  if (!Number.isFinite(length) || length < 0 || length > limit) throw new Error('SIZE_LIMIT');
  const reader = message.body?.getReader();
  if (!reader) throw new Error('BODY_REQUIRED');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > limit) throw new Error('SIZE_LIMIT');
      chunks.push(part.value);
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

function payloadSafe(value: unknown, depth = 0): boolean {
  if (depth > 12) return false;
  if (Array.isArray(value)) return value.every(child => payloadSafe(child, depth + 1));
  if (!object(value)) return value === null || ['string', 'boolean', 'number'].includes(typeof value);
  return Object.entries(value).every(([key, child]) =>
    !/(password|secret|credential|private_key|token|cookie|bearer|authorization|api_key|approval_id)/i.test(key) &&
    !['__proto__', 'constructor', 'prototype'].includes(key) && payloadSafe(child, depth + 1));
}
function argumentsBound(operation: Operation, args: Json, subject: string, workspace: string): boolean {
  if (operation === 'view' || operation === 'status') return keys(args, ['request_id']) && id(args.request_id);
  if (operation === 'confirm') return keys(args, ['request_id', 'reviewed_digest']) && id(args.request_id) && hash(args.reviewed_digest);
  if (operation === 'revoke') return keys(args, ['grant_id']) && id(args.grant_id);
  if (!keys(args, ['workspace_id', 'device_id', 'requests'], ['duration_seconds']) ||
      args.workspace_id !== workspace || !id(args.device_id) || !Array.isArray(args.requests) ||
      args.requests.length < 1 || args.requests.length > 25 ||
      (args.duration_seconds !== undefined && (!integer(args.duration_seconds) || args.duration_seconds < 30 || args.duration_seconds > 3600))) return false;
  const first = args.requests[0];
  if (!object(first) || !object(first.agent)) return false;
  const firstAgentId = first.agent.agent_id;
  return args.requests.every(request => {
    if (!object(request) || !keys(request, ['plan_id', 'plan_hash', 'route_id', 'agent', 'payload']) ||
        !id(request.plan_id) || !hash(request.plan_hash) || !ROUTES.has(String(request.route_id)) ||
        !object(request.agent) || !keys(request.agent, ['agent_id', 'principal']) || !id(request.agent.agent_id) ||
        request.agent.principal !== 'oauth:' + subject || request.plan_id !== first.plan_id ||
        request.plan_hash !== first.plan_hash || request.agent.agent_id !== firstAgentId ||
        !object(request.payload) || !keys(request.payload, ['action', 'arguments']) ||
        !object(request.payload.arguments) || !payloadSafe(request.payload)) return false;
    const input = request.payload.arguments;
    if (request.route_id === 'route.desktop-native.fs-write') {
      return request.payload.action === 'device.fs.write' && keys(input, ['path', 'content', 'mode']) &&
        text(input.path) && typeof input.content === 'string' && input.mode === 'create_new';
    }
    return request.payload.action === 'browser.remote.connect' &&
      keys(input, ['plan_id', 'agent_identity', 'step_id', 'ttl_seconds']) &&
      input.plan_id === request.plan_id && input.agent_identity === request.agent.agent_id && id(input.step_id) &&
      integer(input.ttl_seconds) && input.ttl_seconds >= 30 && input.ttl_seconds <= 600;
  });
}

async function linkedSubject(actorId: string): Promise<string | null> {
  const serverKey = process.env.DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serverKey) throw new Error('IDENTITY_MAPPING_UNAVAILABLE');
  const config = getDsgSupabaseRpcConfig();
  if (config.key !== serverKey) throw new Error('IDENTITY_MAPPING_UNAVAILABLE');
  const rows = await readDsgRest<Json[]>(config, 'dsg_auth0_identity_links', {
    actor_id: 'eq.' + actorId, select: 'actor_id,auth0_sub,auth0_issuer,auth0_client_id', limit: '1',
  }, { timeoutMs: 5000 });
  const link = rows[0];
  return link?.actor_id === actorId && link.auth0_issuer === DSG_AUTH0_ISSUER &&
    link.auth0_client_id === DSG_AUTH0_CLIENT_ID && text(link.auth0_sub, 256) ? link.auth0_sub : null;
}

function safeScope(value: unknown, workspace: string): Json | null {
  if (!object(value) || !id(value.plan_id) || !hash(value.plan_hash) || value.workspace_id !== workspace ||
      !id(value.device_id) || !id(value.agent_id) || !integer(value.expires_at) ||
      !Array.isArray(value.steps) || value.steps.length < 1 || value.steps.length > 25) return null;
  const steps: Json[] = [];
  for (const row of value.steps) {
    if (!object(row) || !id(row.step_id) || !ROUTES.has(String(row.route_id)) ||
        !hash(row.payload_hash) || !text(row.origin, 512) || !text(row.effect, 100) ||
        !['high', 'medium'].includes(String(row.risk))) return null;
    const step: Json = { step_id: row.step_id, route_id: row.route_id, payload_hash: row.payload_hash,
      origin: row.origin, effect: row.effect, risk: row.risk };
    for (const name of ['target_ref', 'review_summary']) {
      if (row[name] !== undefined) {
        if (!text(row[name])) return null;
        step[name] = row[name];
      }
    }
    steps.push(step);
  }
  return { plan_id: value.plan_id, plan_hash: value.plan_hash, workspace_id: workspace,
    device_id: value.device_id, agent_id: value.agent_id, expires_at: value.expires_at, steps };
}

// Project the deliberately public workflow receipt. Never return grants,
// permits, provider payloads or an upstream error body through this bridge.
function safeReceipt(operation: Operation, value: unknown, args: Json, workspace: string): Json | null {
  if (!object(value) || value.error !== undefined || value.ok === false) return null;
  if (operation === 'stage') {
    return value.status === 'PENDING' && id(value.request_id) && integer(value.expires_at) && value.next_action === 'REVIEW_PLAN'
      ? { request_id: value.request_id, status: 'PENDING', expires_at: value.expires_at, next_action: 'REVIEW_PLAN' } : null;
  }
  if (operation === 'view') {
    const scope = safeScope(value.scope, workspace);
    return value.status === 'VIEWED' && value.request_id === args.request_id && hash(value.review_digest) && scope && value.next_action === 'OWNER_MFA'
      ? { request_id: value.request_id, status: 'VIEWED', review_digest: value.review_digest, scope, next_action: 'OWNER_MFA' } : null;
  }
  if (operation === 'confirm') {
    if (value.status !== 'ACTIVE' || !id(value.grant_id) || !hash(value.grant_digest) ||
        value.review_request_id !== args.request_id || !['OBSERVE_JOB', 'CONFIGURE_WORKER'].includes(String(value.next_action)) ||
        (value.job_id !== undefined && !id(value.job_id))) return null;
    return { status: 'ACTIVE', grant_id: value.grant_id, grant_digest: value.grant_digest,
      review_request_id: value.review_request_id, next_action: value.next_action,
      ...(value.job_id !== undefined ? { job_id: value.job_id } : {}) };
  }
  if (operation === 'revoke') return value.status === 'REVOKED' && value.grant_id === args.grant_id
    ? { status: 'REVOKED', grant_id: value.grant_id } : null;
  if (value.workflow_version !== 'dsg.bounded-plan.workflow.v1' || value.request_id !== args.request_id ||
      value.workspace_id !== workspace || !id(value.device_id) || !id(value.plan_id) || !hash(value.plan_hash) ||
      !text(value.status, 60) || !/^[A-Z_]+$/.test(value.status) ||
      !text(value.next_action, 60) || !/^[A-Z_]+$/.test(value.next_action) ||
      !['NOT_GRANTED', 'ACTIVE', 'REVOKED', 'EXPIRED'].includes(String(value.authorization_status)) ||
      !integer(value.completed_steps) || !integer(value.total_steps) || value.total_steps < 1 || value.total_steps > 25 ||
      !Array.isArray(value.steps) || value.steps.length !== value.total_steps || value.automatic_retry !== false ||
      (value.grant_id !== null && !id(value.grant_id)) || (value.job_id !== null && !id(value.job_id))) return null;
  const steps: Json[] = [];
  for (const row of value.steps) {
    if (!object(row) || !id(row.step_id) || !ROUTES.has(String(row.route_id)) || !text(row.status, 60) || !/^[A-Z_]+$/.test(row.status) ||
        (row.evidence_hash !== undefined && !hash(row.evidence_hash))) return null;
    if (row.status === 'COMPLETED' && !hash(row.evidence_hash)) return null;
    steps.push({ step_id: row.step_id, route_id: row.route_id, status: row.status,
      ...(row.evidence_hash !== undefined ? { evidence_hash: row.evidence_hash } : {}) });
  }
  if (steps.filter(step => step.status === 'COMPLETED').length !== value.completed_steps ||
      value.completion_verified !== (value.status === 'COMPLETED') ||
      (value.completion_verified && value.completed_steps !== value.total_steps)) return null;
  return { workflow_version: value.workflow_version, request_id: value.request_id,
    plan_id: value.plan_id, plan_hash: value.plan_hash, workspace_id: workspace, device_id: value.device_id,
    status: value.status, authorization_status: value.authorization_status, next_action: value.next_action,
    completed_steps: value.completed_steps, total_steps: value.total_steps, steps,
    job_id: value.job_id, grant_id: value.grant_id, completion_verified: value.completion_verified, automatic_retry: false };
}

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== 'https://dsg.pics') return blocked(403, 'ORIGIN_DENIED');
  if (!jsonContentType(request.headers)) return blocked(415, 'JSON_REQUIRED');
  let body: unknown;
  try { body = await readJson(request, MAX_BODY); } catch { return blocked(400, 'INVALID_OR_OVERSIZED_JSON'); }
  if (!object(body) || !keys(body, ['operation', 'accessToken', 'arguments']) || typeof body.operation !== 'string' ||
      !text(body.accessToken, 15_000) || !object(body.arguments))
    return blocked(400, 'INVALID_BOUNDED_PLAN_BODY');
  if (!OPERATIONS.has(body.operation)) return blocked(403, 'BOUNDED_OPERATION_NOT_EXPOSED');
  const operation = body.operation as Operation;
  let actor: Awaited<ReturnType<typeof resolveVerifiedDsgActor>>;
  try { actor = await resolveVerifiedDsgActor(request.headers); } catch { return blocked(401, 'DSG_SITE_IDENTITY_NOT_VERIFIED'); }
  if (!actor) return blocked(401, 'DSG_SITE_IDENTITY_NOT_VERIFIED');
  try { assertDsgPermission(actor, operation === 'status' || operation === 'view' ? 'job:read' : 'approval:write'); }
  catch { return blocked(403, 'DSG_WORKSPACE_PERMISSION_DENIED'); }
  if (actor.role !== 'OWNER') return blocked(403, 'BOUNDED_OWNER_REQUIRED');
  const requiredScope = operation === 'confirm' ? 'dsg.approve' : 'dsg.use';
  const verified = await verifyDsgAuth0Principal(body.accessToken, requiredScope);
  if (!verified) return blocked(401, 'USER_AUTH0_TOKEN_NOT_VERIFIED');
  if (verified.scope !== requiredScope || (requiredScope === 'dsg.use' && verified.hasApprovalScope) ||
      (operation === 'confirm' && verified.mfaProofVerified !== true)) return blocked(403, 'BOUNDED_OAUTH_CLASS_OR_MFA_REQUIRED');
  let subject: string | null;
  try { subject = await linkedSubject(actor.actorId); } catch { return blocked(503, 'IDENTITY_LINK_STORE_UNAVAILABLE'); }
  if (!subject || subject !== verified.subject) return blocked(403, 'SITE_AUTH0_SUBJECT_BINDING_MISMATCH');
  if (!argumentsBound(operation, body.arguments, subject, actor.workspaceId)) return blocked(403, 'BOUNDED_ARGUMENTS_NOT_BOUND');
  try {
    const response = await fetch(UPSTREAM + operation, { method: 'POST', redirect: 'error', cache: 'no-store',
      signal: AbortSignal.timeout(30_000), headers: { Authorization: 'Bearer ' + body.accessToken,
        'Content-Type': 'application/json', Accept: 'application/json', Origin: 'https://dsg.pics' },
      body: JSON.stringify(body.arguments) });
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      if (response.status === 404) return blocked(404, 'BOUNDED_PLAN_NOT_CONFIGURED', 'Configure the trusted bounded-plan provider and worker before starting this plan.');
      if (response.status === 403) return blocked(403, 'BOUNDED_PLAN_POLICY_DENIED', 'Review the existing plan scope, owner MFA and provider requirements.');
      if (response.status === 401) return blocked(401, 'AWS_USER_OAUTH_REJECTED');
      return blocked(response.status === 400 ? 400 : 503, 'BOUNDED_PLAN_UPSTREAM_UNAVAILABLE');
    }
    if (!jsonContentType(response.headers)) {
      await response.body?.cancel().catch(() => undefined);
      return blocked(502, 'BOUNDED_RECEIPT_INVALID');
    }
    let raw: unknown;
    try { raw = await readJson(response, MAX_RESPONSE); } catch { return blocked(502, 'BOUNDED_RECEIPT_INVALID'); }
    const receipt = safeReceipt(operation, raw, body.arguments, actor.workspaceId);
    if (!receipt) return blocked(502, 'BOUNDED_RECEIPT_NOT_BOUND');
    return NextResponse.json({ ok: true, userPrincipalVerified: true, workspaceId: actor.workspaceId, receipt },
      { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return blocked(503, operation === 'confirm' ? 'BOUNDED_PLAN_CONFIRMATION_UNCERTAIN' : 'BOUNDED_PLAN_UPSTREAM_UNAVAILABLE',
      operation === 'confirm' ? 'Read this existing request status before any further confirmation; do not replay it.' : undefined);
  }
}
