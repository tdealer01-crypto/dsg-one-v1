import { NextResponse } from 'next/server';
import {
  assertDsgPermission,
  requireVerifiedDsgActor,
  resolveVerifiedDsgUser,
  type DsgPermission,
  type DsgServerActor,
  type VerifiedDsgUser,
} from './context';

// Shared guard for API routes that spend server-held credentials or touch workspace state.
// middleware.ts only protects pages, so every such handler must call one of these first.
// Raw error text never reaches the caller; only the codes below do.
const KNOWN: Record<string, number> = {
  DSG_AUTH_REQUIRED: 401,
  DSG_CONTEXT_REQUIRED: 403,
  DSG_PERMISSION_DENIED: 403,
};

function deny(status: number, code: string): NextResponse {
  return NextResponse.json({ ok: false, error: { code } }, { status, headers: { 'Cache-Control': 'no-store' } });
}

function denial(error: unknown): NextResponse {
  const code = error instanceof Error ? error.message : '';
  return code in KNOWN ? deny(KNOWN[code], code) : deny(503, 'DSG_AUTH_VERIFICATION_FAILED');
}

export type ActorGuard = { ok: true; actor: DsgServerActor } | { ok: false; response: NextResponse };
export type UserGuard = { ok: true; user: VerifiedDsgUser } | { ok: false; response: NextResponse };

export async function authorizeDsgRoute(headers: Headers, permission: DsgPermission): Promise<ActorGuard> {
  try {
    return { ok: true, actor: await requireVerifiedDsgActor(headers, permission) };
  } catch (error) {
    return { ok: false, response: denial(error) };
  }
}

// A second permission on an already verified actor (no second round trip to the auth server).
export function requireActorPermission(actor: DsgServerActor, permission: DsgPermission): NextResponse | null {
  try {
    assertDsgPermission(actor, permission);
    return null;
  } catch (error) {
    return denial(error);
  }
}

export async function authorizeDsgUser(headers: Headers): Promise<UserGuard> {
  try {
    const user = await resolveVerifiedDsgUser(headers);
    return user ? { ok: true, user } : { ok: false, response: deny(401, 'DSG_AUTH_REQUIRED') };
  } catch (error) {
    return { ok: false, response: denial(error) };
  }
}

export function workspaceMismatch(actor: DsgServerActor, claimed: unknown): NextResponse | null {
  return typeof claimed === 'string' && claimed === actor.workspaceId ? null : deny(403, 'DSG_WORKSPACE_MISMATCH');
}

export { deny as denyRoute };
