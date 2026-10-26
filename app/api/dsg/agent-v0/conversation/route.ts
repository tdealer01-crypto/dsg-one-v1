import { NextResponse } from 'next/server';
import { requireVerifiedDsgActor } from '@/lib/dsg/server/context';
import { listAgentConversation } from '@/lib/dsg/agent-runtime/chat-history';
import { persistAgentChatTurn } from '@/lib/dsg/agent-runtime/persistent-chat-memory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 8_192;
const SENSITIVE = /(github_pat_|ghp_|sk-proj-|dsg_pair_|\bBearer\s+[A-Za-z0-9._~-]{20,}|AKIA[0-9A-Z]{16})/i;

function respond(status: number, data: Record<string, unknown>) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

function actorIdentity(actor: { actorId: string; workspaceId: string; role: string }) {
  return { actorId: actor.actorId, workspaceId: actor.workspaceId, actorRole: actor.role };
}

export async function GET(req: Request) {
  try {
    const actor = await requireVerifiedDsgActor(req.headers, 'job:read');
    const messages = await listAgentConversation(actorIdentity(actor));
    return respond(200, { ok: true, data: { messages, source: 'dsg_memory_events', scope: 'verified_actor_workspace' } });
  } catch {
    return respond(503, { ok: false, error: 'AGENT_V0_MEMORY_READ_UNAVAILABLE' });
  }
}

// This is persistence only. It never starts a separate chat model, grants
// provider authority, or treats text as a verified execution receipt.
export async function POST(req: Request) {
  if (req.headers.get('origin') !== 'https://dsg.pics') {
    return respond(403, { ok: false, error: 'ORIGIN_DENIED' });
  }
  let actor;
  try {
    actor = await requireVerifiedDsgActor(req.headers, 'job:control');
  } catch {
    return respond(403, { ok: false, error: 'AGENT_V0_MEMORY_WRITE_FORBIDDEN' });
  }
  if (!req.headers.get('content-type')?.startsWith('application/json')) {
    return respond(415, { ok: false, error: 'JSON_REQUIRED' });
  }
  const length = Number(req.headers.get('content-length') || '0');
  if (!Number.isSafeInteger(length) || length > MAX_BYTES || length < 0) {
    return respond(413, { ok: false, error: 'AGENT_V0_MEMORY_TOO_LARGE' });
  }
  let raw: string;
  try {
    raw = await req.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_BYTES) return respond(413, { ok: false, error: 'AGENT_V0_MEMORY_TOO_LARGE' });
  } catch {
    return respond(400, { ok: false, error: 'AGENT_V0_MEMORY_BODY_INVALID' });
  }
  let body: unknown;
  try { body = JSON.parse(raw); }
  catch { return respond(400, { ok: false, error: 'AGENT_V0_MEMORY_BODY_INVALID' }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return respond(400, { ok: false, error: 'AGENT_V0_MEMORY_BODY_INVALID' });
  }
  const b = body as Record<string, unknown>;
  if (Object.keys(b).some(key => !['role', 'text'].includes(key)) ||
      (b.role !== 'user' && b.role !== 'assistant') ||
      typeof b.text !== 'string' || !b.text.trim() || b.text.length > 2400) {
    return respond(400, { ok: false, error: 'AGENT_V0_MEMORY_CONTRACT_INVALID' });
  }
  if (SENSITIVE.test(b.text)) return respond(400, { ok: false, error: 'AGENT_V0_MEMORY_SECRET_REJECTED' });
  const result = await persistAgentChatTurn(req, {
    userMessage: b.role === 'user' ? b.text : '',
    agentReply: b.role === 'assistant' ? b.text : '',
  }, actorIdentity(actor)).catch(() => ({ saved: [], errors: ['MEMORY_PERSIST_FAILED'] }));
  if (result.saved.length !== 1 || result.errors.length) {
    return respond(503, { ok: false, error: 'AGENT_V0_MEMORY_PERSIST_UNVERIFIED' });
  }
  return respond(201, { ok: true, data: { persisted: true, source: 'dsg_memory_events' } });
}
