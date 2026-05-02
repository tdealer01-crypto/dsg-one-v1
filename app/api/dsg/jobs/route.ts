import { NextResponse } from 'next/server';
import { assertDsgPermission, devHeaderActor } from '@/lib/dsg/server/context';
import { createRuntimeJob } from '@/lib/dsg/server/repository';
import { getBearerToken } from '@/lib/dsg/server/supabase-rpc';

export async function GET(request: Request) {
  const actor = assertDsgPermission(devHeaderActor(request.headers), 'job:read');
  return NextResponse.json({ ok: true, data: { actor, jobs: [], source: 'database-read-route-pending' } });
}

export async function POST(request: Request) {
  const actor = assertDsgPermission(devHeaderActor(request.headers), 'job:create');
  const body = (await request.json().catch(() => null)) as { goal?: string; successCriteria?: unknown[] } | null;
  if (!body?.goal?.trim()) {
    return NextResponse.json({ ok: false, error: { code: 'DSG_GOAL_REQUIRED' } }, { status: 400 });
  }

  try {
    const data = await createRuntimeJob(
      { workspaceId: actor.workspaceId, actorId: actor.actorId, userAccessToken: getBearerToken(request.headers) },
      { goal: body.goal, successCriteria: body.successCriteria },
    );
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: { code: error instanceof Error ? error.message : 'DSG_CREATE_JOB_FAILED' } },
      { status: 403 },
    );
  }
}
