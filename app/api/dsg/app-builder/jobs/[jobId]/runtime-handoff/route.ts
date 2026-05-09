import { NextResponse } from 'next/server';
import { createAppBuilderRuntimeHandoff } from '@/lib/dsg/app-builder/runtime-handoff';
import { getAppBuilderRequestContext } from '@/lib/dsg/server/app-builder/context';
import { getAppBuilderJob } from '@/lib/dsg/server/app-builder/repository';

function fail(error: unknown) {
  const code = error instanceof Error ? error.message : 'APP_BUILDER_RUNTIME_HANDOFF_FAILED';
  const status = code.startsWith('DSG_') ? 401 : 400;
  return NextResponse.json({ ok: false, error: { code, message: code } }, { status });
}

export async function POST(req: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await context.params;
    const ctx = await getAppBuilderRequestContext(req, 'job:control');
    const job = await getAppBuilderJob(ctx, jobId);
    const handoff = createAppBuilderRuntimeHandoff(job);
    return NextResponse.json({ ok: true, data: handoff });
  } catch (error) {
    return fail(error);
  }
}
