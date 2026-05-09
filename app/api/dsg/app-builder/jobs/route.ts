import { NextResponse } from 'next/server';
import { lockAppBuilderGoal } from '@/lib/dsg/app-builder/goal-lock';
import type { AppBuilderGoalInput } from '@/lib/dsg/app-builder/model';
import { getAppBuilderRequestContext } from '@/lib/dsg/server/app-builder/context';
import { createAppBuilderJob, listAppBuilderJobs } from '@/lib/dsg/server/app-builder/repository';

function fail(error: unknown) {
  const code = error instanceof Error ? error.message : 'APP_BUILDER_REQUEST_FAILED';
  const status = code === 'DSG_AUTH_REQUIRED' || code === 'DSG_CONTEXT_REQUIRED' || code === 'DSG_PERMISSION_DENIED' ? 401 : 400;
  return NextResponse.json({ ok: false, error: { code, message: code } }, { status });
}

export async function GET(req: Request) {
  try {
    const ctx = await getAppBuilderRequestContext(req, 'job:read');
    const jobs = await listAppBuilderJobs(ctx);
    return NextResponse.json({ ok: true, data: jobs });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getAppBuilderRequestContext(req, 'job:create');
    const rawGoal = (await req.json()) as AppBuilderGoalInput;
    const lockedGoal = lockAppBuilderGoal(rawGoal);
    const job = await createAppBuilderJob({ ctx, rawGoal, lockedGoal });
    return NextResponse.json({ ok: true, data: job });
  } catch (error) {
    return fail(error);
  }
}
