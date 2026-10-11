import { NextResponse } from 'next/server';
import { requireVerifiedDsgActor } from '@/lib/dsg/server/context';
import { prepareGovernedToolRequest, type DsgGovernedToolRequest } from '@/lib/dsg/tools/governed-tools';

// Public HTTP is a plan/inspection boundary, never an execution or approval
// authority. Signed execution belongs to the authenticated Spacetime provider.
export const dynamic = 'force-dynamic';

function reply(status: number, code: string) {
  return NextResponse.json({ ok: false, error: { code, message: code } }, {
    status, headers: { 'Cache-Control': 'no-store' },
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean) : [];
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin');
  if (origin && origin !== 'https://dsg.pics') return reply(403, 'DSG_ORIGIN_DENIED');

  // Middleware's JWT shape check is NOT a signature check. This handler
  // verifies the real Supabase subject plus workspace membership and role.
  try {
    await requireVerifiedDsgActor(req.headers, 'job:plan');
  } catch (error) {
    const code = error instanceof Error ? error.message : 'DSG_AUTH_REQUIRED';
    return reply(code === 'DSG_PERMISSION_DENIED' ? 403 : 401, 'DSG_IDENTITY_OR_PERMISSION_NOT_VERIFIED');
  }

  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return reply(415, 'DSG_JSON_REQUIRED');
  }
  const size = Number(req.headers.get('content-length') || '0');
  if (!Number.isFinite(size) || size > 32768 || size < 0) return reply(413, 'DSG_BODY_TOO_LARGE');

  let body: Record<string, unknown>;
  try {
    const text = await req.text();
    if (Buffer.byteLength(text, 'utf8') > 32768) return reply(413, 'DSG_BODY_TOO_LARGE');
    body = asRecord(JSON.parse(text));
  } catch {
    return reply(400, 'DSG_INVALID_JSON');
  }

  // A client-provided approved=true or sandboxRoot is untrusted. Never
  // execute shell/file/browser/network/provider actions through this endpoint.
  if (body.execute === true) return reply(403, 'DSG_SIGNED_EXECUTION_AUTHORITY_REQUIRED');

  const input: DsgGovernedToolRequest = {
    tool: String(body.tool || '').trim() as DsgGovernedToolRequest['tool'],
    action: String(body.action || '').trim() as DsgGovernedToolRequest['action'],
    goal: String(body.goal || '').trim(),
    args: {
      ...asRecord(body.args),
      ...(Array.isArray(body.allowedHosts) ? { allowedHosts: stringArray(body.allowedHosts) } : {}),
    },
    evidence: stringArray(body.evidence),
    history: stringArray(body.history),
  };
  // Do not propagate caller-supplied approval flags into the inspector.
  delete input.args?.approved;
  delete input.args?.sandboxRoot;

  if (!['shell', 'file', 'browser', 'search', 'schedule', 'plan', 'workflow', 'api',
        'google_workspace', 'persistent_compute'].includes(input.tool)) {
    return reply(400, 'DSG_TOOL_UNSUPPORTED');
  }
  const result = prepareGovernedToolRequest(input);
  return NextResponse.json(result, {
    status: result.ok ? 200 : 400, headers: { 'Cache-Control': 'no-store' },
  });
}
