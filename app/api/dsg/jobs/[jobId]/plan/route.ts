import { NextResponse } from 'next/server';
import { requireVerifiedDsgActor } from '@/lib/dsg/server/context';
import { createRuntimePlan } from '@/lib/dsg/server/repository';
import { getBearerToken } from '@/lib/dsg/server/supabase-rpc';
import type { RuntimeTask } from '@/lib/dsg/runtime/types';

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const actor = await requireVerifiedDsgActor(request.headers, 'job:plan');
  const { jobId } = await context.params;
  const body = (await request.json().catch(() => null)) as { tasks?: RuntimeTask[] } | null;
  if (!body?.tasks?.length) {
    return NextResponse.json({ ok: false, error: { code: 'DSG_TASKS_REQUIRED' } }, { status: 400 });
  }

  try {
    const data = await createRuntimePlan(
      { workspaceId: actor.workspaceId, actorId: actor.actorId, userAccessToken: getBearerToken(request.headers) },
      { jobId, tasks: body.tasks },
    );
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: { code: error instanceof Error ? error.message : 'DSG_PLAN_FAILED' } },
      { status: 403 },
    );
  }
}
