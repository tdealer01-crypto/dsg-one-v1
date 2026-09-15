import { NextRequest, NextResponse } from 'next/server';
import { getDsgSupabaseRpcConfig, readDsgRest } from '@/lib/dsg/server/supabase-rpc';

type User = { id?: string; sub?: string; email?: string };
type Membership = { workspace_id: string; role: 'OWNER' | 'ADMIN' | 'OPERATOR' | 'AUDITOR' | 'VIEWER' };

export async function GET(request: NextRequest) {
  const token = request.cookies.get('sb-access-token')?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: 'DSG_AUTH_REQUIRED' }, { status: 401 });
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

  const memberships = await readDsgRest<Membership[]>(getDsgSupabaseRpcConfig(), 'dsg_workspace_members', {
    actor_id: `eq.${actorId}`,
    select: 'workspace_id,role',
    order: 'workspace_id.asc',
  });

  const selectedWorkspaceId = request.cookies.get('dsg-workspace-id')?.value;
  const selected = memberships.find((item) => item.workspace_id === selectedWorkspaceId) ?? null;

  return NextResponse.json({
    ok: true,
    actor: { id: actorId, email: user.email ?? null },
    memberships,
    selected,
  });
}
