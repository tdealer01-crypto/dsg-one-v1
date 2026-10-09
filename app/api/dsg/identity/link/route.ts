import { NextRequest, NextResponse } from 'next/server';
import { resolveVerifiedDsgActor } from '@/lib/dsg/server/context';
import { getDsgSupabaseRpcConfig, readDsgRest } from '@/lib/dsg/server/supabase-rpc';
import { verifyDsgAuth0Principal, DSG_AUTH0_CLIENT_ID, DSG_AUTH0_ISSUER } from '@/lib/dsg/server/auth0-identity';

export const dynamic = 'force-dynamic';

type IdentityLink = {
  actor_id: string;
  auth0_sub: string;
  auth0_issuer: string;
  auth0_client_id: string;
  verified_at: string;
};

function serviceConfig() {
  // Anonymous/publishable keys MUST NOT be used to write or read identity mappings.
  const serverOnly = process.env.DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serverOnly) throw new Error('DSG_IDENTITY_SERVICE_ROLE_REQUIRED');
  const config = getDsgSupabaseRpcConfig();
  if (config.key !== serverOnly) throw new Error('DSG_IDENTITY_SERVICE_ROLE_REQUIRED');
  return config;
}

async function readLink(actorId: string): Promise<IdentityLink | null> {
  const records = await readDsgRest<IdentityLink[]>(
    serviceConfig(), 'dsg_auth0_identity_links', {
      actor_id: 'eq.' + actorId,
      select: 'actor_id,auth0_sub,auth0_issuer,auth0_client_id,verified_at',
      limit: '1',
    },
  );
  return records[0] ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const actor = await resolveVerifiedDsgActor(request.headers);
    if (!actor) return NextResponse.json({ ok: false, linked: false, error: 'DSG_WORKSPACE_AUTH_REQUIRED' }, { status: 401 });
    const existing = await readLink(actor.actorId);
    return NextResponse.json({
      ok: true, linked: Boolean(existing),
      actorId: actor.actorId, workspaceId: actor.workspaceId,
      principal: existing ? { sub: existing.auth0_sub, issuer: existing.auth0_issuer, verifiedAt: existing.verified_at } : null,
      n2nApprovalGranted: false,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, linked: false, error: 'IDENTITY_LINK_READ_NOT_READY' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  // Same-origin, user-initiated only. No background identity enrollment.
  if (request.headers.get('origin') !== 'https://dsg.pics') {
    return NextResponse.json({ ok: false, error: 'ORIGIN_DENIED' }, { status: 403 });
  }
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return NextResponse.json({ ok: false, error: 'JSON_REQUIRED' }, { status: 415 });
  }
  try {
    const actor = await resolveVerifiedDsgActor(request.headers);
    if (!actor) return NextResponse.json({ ok: false, error: 'DSG_WORKSPACE_AUTH_REQUIRED' }, { status: 401 });
    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (!Number.isFinite(contentLength) || contentLength > 18000) {
      return NextResponse.json({ ok: false, error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
    }
    const data = await request.json() as Record<string, unknown>;
    const principal = await verifyDsgAuth0Principal(data?.accessToken);
    if (!principal) return NextResponse.json({ ok: false, error: 'INVALID_AUTH0_ACCESS_TOKEN' }, { status: 401 });

    const existing = await readLink(actor.actorId);
    if (existing) {
      if (existing.auth0_sub !== principal.subject ||
          existing.auth0_issuer !== DSG_AUTH0_ISSUER ||
          existing.auth0_client_id !== DSG_AUTH0_CLIENT_ID) {
        return NextResponse.json({ ok: false, error: 'ACTOR_ALREADY_LINKED_TO_DIFFERENT_IDENTITY' }, { status: 409 });
      }
      return NextResponse.json({ ok: true, linked: true, alreadyLinked: true, actorId: actor.actorId, auth0Sub: principal.subject, n2nApprovalGranted: false });
    }

    const config = serviceConfig();
    const response = await fetch(config.url + '/rest/v1/dsg_auth0_identity_links', {
      method: 'POST',
      headers: {
        apikey: config.key,
        ...(!config.key.startsWith('sb_') ? { Authorization: 'Bearer ' + config.key } : {}),
        'Content-Type': 'application/json',
        'Content-Profile': 'public',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        actor_id: actor.actorId,
        auth0_sub: principal.subject,
        auth0_issuer: principal.issuer,
        auth0_client_id: principal.clientId,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 409) {
      return NextResponse.json({ ok: false, error: 'IDENTITY_SUBJECT_ALREADY_BOUND' }, { status: 409 });
    }
    if (!response.ok) return NextResponse.json({ ok: false, error: 'IDENTITY_BIND_PERSIST_FAILED' }, { status: 503 });
    const readback = await readLink(actor.actorId);
    if (readback?.auth0_sub !== principal.subject) {
      return NextResponse.json({ ok: false, error: 'IDENTITY_BIND_READBACK_FAILED' }, { status: 503 });
    }
    return NextResponse.json({
      ok: true, linked: true, alreadyLinked: false,
      actorId: actor.actorId, auth0Sub: principal.subject,
      workspaceId: actor.workspaceId, n2nApprovalGranted: false,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'IDENTITY_LINK_UNAVAILABLE' }, { status: 503 });
  }
}
