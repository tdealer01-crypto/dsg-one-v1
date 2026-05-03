import { NextResponse } from 'next/server';
import { createAppBuilderRuntimeHandoff } from '@/lib/dsg/app-builder/runtime-handoff';
import { getDevAppBuilderContext } from '@/lib/dsg/server/app-builder/context';
import { getAppBuilderJob } from '@/lib/dsg/server/app-builder/repository';

function fail(error: unknown) {
  const code = error instanceof Error ? error.message : 'APP_BUILDER_RUNTIME_HANDOFF_FAILED';
  return NextResponse.json({ ok: false, error: { code, message: code } }, { status: 400 });
}

export async function POST(req: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await context.params;
    const ctx = getDevAppBuilderContext(req);
    const job = await getAppBuilderJob(ctx, jobId);
    const handoff = createAppBuilderRuntimeHandoff(job);
    return NextResponse.json({ ok: true, data: handoff });
  } catch (error) {
    return fail(error);
  }
}
