import { NextResponse } from 'next/server';
import { getBearerToken, getDsgSupabaseRpcConfig } from '@/lib/dsg/server/supabase-rpc';
import { createWorkspace } from '@/lib/dsg/server/repository';

type SupabaseUserResponse = { id?: string; sub?: string };

async function requireSupabaseUser(headers: Headers): Promise<string> {
  const userAccessToken = getBearerToken(headers);
  if (!userAccessToken) throw new Error('DSG_AUTH_REQUIRED');
  const config = getDsgSupabaseRpcConfig(userAccessToken);
  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: { apikey: config.key, Authorization: `Bearer ${userAccessToken}` },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('DSG_AUTH_REQUIRED');
  const user = (await response.json()) as SupabaseUserResponse;
  const actorId = user.id ?? user.sub;
  if (!actorId) throw new Error('DSG_AUTH_REQUIRED');
  return actorId;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { name?: string; slug?: string } | null;
  if (!body?.name?.trim() || !body.slug?.trim()) {
    return NextResponse.json({ ok: false, error: { code: 'DSG_WORKSPACE_INPUT_REQUIRED' } }, { status: 400 });
  }

  try {
    const actorId = await requireSupabaseUser(request.headers);
    const id = await createWorkspace(
      { actorId, userAccessToken: getBearerToken(request.headers) },
      { name: body.name, slug: body.slug },
    );
    return NextResponse.json({ ok: true, data: { id } }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: { code: error instanceof Error ? error.message : 'DSG_CREATE_WORKSPACE_FAILED' } },
      { status: 403 },
    );
  }
}
