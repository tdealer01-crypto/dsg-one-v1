import { NextResponse } from 'next/server';
import { devHeaderActor } from '@/lib/dsg/server/context';
import { createWorkspace } from '@/lib/dsg/server/repository';
import { getBearerToken } from '@/lib/dsg/server/supabase-rpc';

export async function POST(request: Request) {
  const actor = devHeaderActor(request.headers);
  if (!actor?.actorId) {
    return NextResponse.json({ ok: false, error: { code: 'DSG_AUTH_REQUIRED' } }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { name?: string; slug?: string } | null;
  if (!body?.name?.trim() || !body.slug?.trim()) {
    return NextResponse.json({ ok: false, error: { code: 'DSG_WORKSPACE_INPUT_REQUIRED' } }, { status: 400 });
  }

  try {
    const id = await createWorkspace(
      { actorId: actor.actorId, userAccessToken: getBearerToken(request.headers) },
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
