import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomUUID } from 'node:crypto';
import { assertDsgPermission, resolveVerifiedDsgActor, type DsgPermission } from '@/lib/dsg/server/context';
import { verifyDsgAuth0Principal, DSG_AUTH0_CLIENT_ID, DSG_AUTH0_ISSUER } from '@/lib/dsg/server/auth0-identity';
import { getDsgSupabaseRpcConfig, readDsgRest } from '@/lib/dsg/server/supabase-rpc';

export const dynamic = 'force-dynamic';

// Delegated OAuth ONLY. This route must NEVER fall back to Spacetime internal,
// owner, workroom or Site credentials when user OAuth is absent/invalid.
const AWS_MCP = 'https://aws.dsg.pics/mcp';
const EXPECTED_ORIGIN = 'https://dsg.pics';
const MAX_BODY = 32_000;
const ALLOWED: Record<string, DsgPermission> = {
  spacetime_control_surface: 'job:read',
  spacetime_discover: 'job:read',
  spacetime_compose: 'job:plan',
  spacetime_request_approval: 'approval:write',
  spacetime_execute: 'job:control',
  spacetime_verify_evidence: 'replay:verify',
  spacetime_read_public_repo: 'job:read',
};

type Json = Record<string, unknown>;
type IdentityLink = {
  actor_id: string;
  auth0_sub: string;
  auth0_issuer: string;
  auth0_client_id: string;
};

function result(status: number, data: Json) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isObject(value: unknown): value is Json {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

async function readBoundedJson(request: NextRequest): Promise<unknown> {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (!Number.isFinite(length) || length < 0 || length > MAX_BODY) throw new Error('PAYLOAD_TOO_LARGE');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('INVALID_BODY');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        size += value.byteLength;
        if (size > MAX_BODY) throw new Error('PAYLOAD_TOO_LARGE');
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
}

// MCP streamable HTTP permits JSON or an SSE stream. Read a bounded response
// and only accept the JSON-RPC result matching our one request ID.
const MAX_MCP_RESPONSE = 256_000;
async function parseMcpEnvelope(response: Response, requestId: string): Promise<unknown> {
  if (!response.body) throw new Error('MCP_EMPTY_BODY');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let total = 0;
  let raw = '';
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > MAX_MCP_RESPONSE) throw new Error('MCP_RESPONSE_TOO_LARGE');
      raw += decoder.decode(chunk.value, { stream: true });
    }
    raw += decoder.decode();
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (contentType.includes('application/json')) return JSON.parse(raw);
  if (!contentType.includes('text/event-stream')) throw new Error('MCP_UNEXPECTED_CONTENT_TYPE');
  for (const frame of raw.split(/\r?\n\r?\n/)) {
    const lines = frame.split(/\r?\n/);
    const eventType = lines.find((line) => line.startsWith('event:'))?.slice(6).trim();
    if (eventType && eventType !== 'message') continue;
    const data = lines.filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart()).join('\n');
    if (!data) continue;
    try {
      const message: unknown = JSON.parse(data);
      if (isObject(message) && message.id === requestId) return message;
    } catch {
      // Continue only over nonmatching event frames; a matching JSON-RPC
      // response must still be well formed or the request fails closed.
    }
  }
  throw new Error('MCP_SSE_MATCHING_RESULT_NOT_FOUND');
}

async function linkedSubject(actorId: string): Promise<string | null> {
  const serviceKey = process.env.DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('IDENTITY_MAPPING_UNAVAILABLE');
  const config = getDsgSupabaseRpcConfig();
  if (config.key !== serviceKey) throw new Error('IDENTITY_MAPPING_UNAVAILABLE');
  const rows = await readDsgRest<IdentityLink[]>(config, 'dsg_auth0_identity_links', {
    actor_id: 'eq.' + actorId,
    select: 'actor_id,auth0_sub,auth0_issuer,auth0_client_id',
    limit: '1',
  });
  const link = rows[0];
  if (!link || link.actor_id !== actorId ||
      link.auth0_issuer !== DSG_AUTH0_ISSUER ||
      link.auth0_client_id !== DSG_AUTH0_CLIENT_ID) return null;
  return link.auth0_sub;
}

function exactAgent(agent: unknown, principal: string): boolean {
  return isObject(agent) &&
    typeof agent.agent_id === 'string' &&
    agent.agent_id.length > 0 && agent.agent_id.length <= 64 &&
    agent.principal === principal;
}

export function toolArgumentsBoundToUser(name: string, args: unknown, subject: string): boolean {
  if (!isObject(args)) return false;
  const principal = 'oauth:' + subject;
  switch (name) {
    case 'spacetime_read_public_repo':
    case 'spacetime_verify_evidence':
    case 'spacetime_control_surface':
      return Object.keys(args).length === 0;
    case 'spacetime_discover':
      return Array.isArray(args.capabilities) && args.capabilities.length > 0 &&
        args.capabilities.length <= 20 &&
        args.capabilities.every((cap: unknown) => typeof cap === 'string' && cap.length > 0 && cap.length <= 128);
    case 'spacetime_compose':
      return Array.isArray(args.participants) && args.participants.length > 0 &&
        args.participants.length <= 8 &&
        args.participants.every((p: unknown) => exactAgent(p, principal));
    case 'spacetime_request_approval':
      return isObject(args.request) && exactAgent(args.request.agent, principal) &&
        typeof args.request.plan_id === 'string' &&
        typeof args.request.plan_hash === 'string' &&
        typeof args.request.route_id === 'string';
    case 'spacetime_execute':
      return exactAgent(args.agent, principal) &&
        typeof args.plan_id === 'string' &&
        typeof args.plan_hash === 'string' &&
        typeof args.route_id === 'string';
    default:
      // In particular, NEVER relay spacetime_resolve_approval through this
      // bridge: AWS runtime currently stamps a general customer principal.
      // Human approval resolution needs a separate end-to-end user-aware gate.
      return false;
  }
}

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== EXPECTED_ORIGIN)
    return result(403, { ok: false, error: 'ORIGIN_DENIED' });
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return result(415, { ok: false, error: 'JSON_REQUIRED' });

  let actor;
  try {
    actor = await resolveVerifiedDsgActor(request.headers);
  } catch {
    return result(401, { ok: false, error: 'DSG_SITE_IDENTITY_NOT_VERIFIED' });
  }
  if (!actor) return result(401, { ok: false, error: 'DSG_SITE_IDENTITY_NOT_VERIFIED' });

  let body: unknown;
  try {
    body = await readBoundedJson(request);
  } catch {
    return result(400, { ok: false, error: 'INVALID_OR_OVERSIZED_JSON' });
  }
  if (!isObject(body) || typeof body.tool !== 'string' || !(body.tool in ALLOWED) ||
      !Object.prototype.hasOwnProperty.call(ALLOWED, body.tool)) {
    return result(403, { ok: false, error: 'TOOL_NOT_EXPOSED_TO_USER_BRIDGE' });
  }

  try {
    assertDsgPermission(actor, ALLOWED[body.tool]);
  } catch {
    return result(403, { ok: false, error: 'DSG_WORKSPACE_PERMISSION_DENIED' });
  }

  const verified = await verifyDsgAuth0Principal(body.accessToken);
  if (!verified) return result(401, { ok: false, error: 'USER_AUTH0_TOKEN_NOT_VERIFIED' });

  let subject: string | null;
  try {
    subject = await linkedSubject(actor.actorId);
  } catch {
    return result(503, { ok: false, error: 'IDENTITY_LINK_STORE_UNAVAILABLE' });
  }
  if (!subject || subject !== verified.subject) {
    return result(403, { ok: false, error: 'SITE_AUTH0_SUBJECT_BINDING_MISMATCH' });
  }

  if (!toolArgumentsBoundToUser(body.tool, body.arguments, verified.subject)) {
    return result(403, { ok: false, error: 'PRINCIPAL_OR_ARGUMENTS_NOT_BOUND' });
  }

  // Verify once more at the provider. AWS only accepts real RS256 Auth0 JWTs,
  // never a Site owner/service token or a website session cookie.
  try {
    const requestId = randomUUID();
    const upstream = await fetch(AWS_MCP, {
      method: 'POST',
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
      headers: {
        Authorization: 'Bearer ' + body.accessToken,
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        'MCP-Protocol-Version': '2025-06-18',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: requestId,
        method: 'tools/call',
        params: { name: body.tool, arguments: body.arguments },
      }),
    });
    if (upstream.status === 401) return result(401, { ok: false, error: 'AWS_USER_OAUTH_REJECTED' });
    if (!upstream.ok) return result(502, { ok: false, error: 'AWS_MCP_HTTP_ERROR', http_status: upstream.status });
    const envelope: unknown = await parseMcpEnvelope(upstream, requestId);
    if (!isObject(envelope) || isObject(envelope.error)) {
      return result(502, { ok: false, error: 'AWS_MCP_RPC_REJECTED' });
    }
    const toolResult = isObject(envelope.result) ? envelope.result : null;
    const structured = toolResult && isObject(toolResult.structuredContent) ? toolResult.structuredContent : null;
    if (!structured) return result(502, { ok: false, error: 'AWS_MCP_STRUCTURED_RECEIPT_REQUIRED' });
    return result(200, {
      ok: toolResult?.isError !== true,
      verdict: toolResult?.isError === true ? 'BLOCKED_BY_RUNTIME' : 'TOOL_RETURNED',
      tool: body.tool,
      actorId: actor.actorId,
      workspaceId: actor.workspaceId,
      auth0SubjectFingerprint: createHash('sha256').update(verified.subject).digest('hex').slice(0, 16),
      receipt: structured,
      evidenceVerified: body.tool === 'spacetime_verify_evidence' && structured.valid === true,
      userPrincipalVerified: true,
      // TOOL_RETURNED is not VERIFIED_COMPLETED. User must prove the provider
      // postcondition independently and approval must come from human authority.
    });
  } catch {
    return result(503, { ok: false, error: 'AWS_MCP_UNREACHABLE' });
  }
}
