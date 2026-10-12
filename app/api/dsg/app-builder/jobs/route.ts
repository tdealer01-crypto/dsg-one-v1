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
    // A body that is not a JSON object is the caller's mistake (400), not a server fault.
    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('APP_BUILDER_REQUEST_INVALID');
    const rawGoal = body as AppBuilderGoalInput;
    let lockedGoal: ReturnType<typeof lockAppBuilderGoal>;
    try {
      lockedGoal = lockAppBuilderGoal(rawGoal);
    } catch (error) {
      // A wrongly typed field (goal not a string, criteria not a list of strings) is the caller's mistake.
      throw error instanceof TypeError ? new Error('APP_BUILDER_REQUEST_INVALID') : error;
    }
    const job = await createAppBuilderJob({ ctx, rawGoal, lockedGoal });
    return NextResponse.json({ ok: true, data: job }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return fail(error);
  }
}
