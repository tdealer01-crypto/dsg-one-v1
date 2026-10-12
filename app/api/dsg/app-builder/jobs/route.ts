import { NextResponse } from 'next/server';
import { lockAppBuilderGoal } from '@/lib/dsg/app-builder/goal-lock';
import type { AppBuilderGoalInput } from '@/lib/dsg/app-builder/model';
import { getAppBuilderRequestContext } from '@/lib/dsg/server/app-builder/context';
import { createAppBuilderJob, listAppBuilderJobs } from '@/lib/dsg/server/app-builder/repository';
import { classifyAppBuilderJobError } from '@/lib/dsg/server/app-builder/job-error';

export const dynamic = 'force-dynamic';

function fail(error: unknown) {
  const { code, status } = classifyAppBuilderJobError(error);
  return NextResponse.json({ ok: false, error: { code, message: code } }, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

export async function GET(req: Request) {
  try {
    const ctx = await getAppBuilderRequestContext(req, 'job:read');
    const jobs = await listAppBuilderJobs(ctx);
    return NextResponse.json({ ok: true, data: jobs }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
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
    return NextResponse.json({ ok: true, data: job }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return fail(error);
  }
}
