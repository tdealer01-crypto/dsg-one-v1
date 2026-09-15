import { NextRequest, NextResponse } from 'next/server';
import { getDsgSupabaseRpcConfig, readDsgRest } from '@/lib/dsg/server/supabase-rpc';

type User = { id?: string; sub?: string };
type Membership = { workspace_id: string; role: 'OWNER' | 'ADMIN' | 'OPERATOR' | 'AUDITOR' | 'VIEWER' };

export async function POST(request: NextRequest) {
  const token = request.cookies.get('sb-access-token')?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: 'DSG_AUTH_REQUIRED' }, { status: 401 });
  }

  const body = await request.json() as { workspaceId?: string };
  if (!body.workspaceId) {
    return NextResponse.json({ ok: false, error: 'WORKSPACE_REQUIRED' }, { status: 400 });
  }

  const config = getDsgSupabaseRpcConfig(token);
  const userResponse = await fetch(`${config.url}/auth/v1/user`, {
    headers: { apikey: config.key, Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!userResponse.ok) {
    return NextResponse.json({ ok: false, error: 'DSG_AUTH_REQUIRED' }, { status: 401 });
  }

  const user = await userResponse.json() as User;
  const actorId = user.id ?? user.sub;
  if (!actorId) {
    return NextResponse.json({ ok: false, error: 'DSG_ACTOR_REQUIRED' }, { status: 403 });
  }

  const rows = await readDsgRest<Membership[]>(getDsgSupabaseRpcConfig(), 'dsg_workspace_members', {
    actor_id: `eq.${actorId}`,
    workspace_id: `eq.${body.workspaceId}`,
    select: 'workspace_id,role',
    limit: '1',
  });
  const membership = rows[0];
  if (!membership) {
    return NextResponse.json({ ok: false, error: 'DSG_WORKSPACE_MEMBERSHIP_REQUIRED' }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true, selected: membership });
  response.cookies.set('dsg-workspace-id', membership.workspace_id, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  });
  return response;
}
