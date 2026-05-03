import { NextResponse } from 'next/server';
import { executeApprovedAppBuilderJob } from '@/lib/dsg/app-builder/action-runtime';
import { getDevAppBuilderContext } from '@/lib/dsg/server/app-builder/context';
import { getAppBuilderJob, updateAppBuilderJob } from '@/lib/dsg/server/app-builder/repository';

function fail(error: unknown) {
  const code = error instanceof Error ? error.message : 'APP_BUILDER_EXECUTE_FAILED';
  return NextResponse.json({ ok: false, error: { code, message: code } }, { status: 400 });
}

export async function POST(req: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await context.params;
    const ctx = getDevAppBuilderContext(req);
    const job = await getAppBuilderJob(ctx, jobId);

    if (job.status !== 'READY_FOR_RUNTIME') throw new Error('APP_BUILDER_JOB_NOT_READY_FOR_RUNTIME');
    if (!job.approvedPlan) throw new Error('APP_BUILDER_APPROVED_PLAN_REQUIRED');

    await updateAppBuilderJob({
      ctx,
      id: jobId,
      patch: {
        status: 'EXECUTING',
        claim_status: 'APPROVED_ONLY',
        metadata: {
          ...(job.metadata ?? {}),
          executionStartedAt: new Date().toISOString(),
        },
      },
    });

    const freshJob = await getAppBuilderJob(ctx, jobId);
    const result = await executeApprovedAppBuilderJob(freshJob);

    const updated = await updateAppBuilderJob({
      ctx,
      id: jobId,
      patch: {
        status: 'PR_CREATED',
        claim_status: result.claimStatus,
        metadata: {
          ...(freshJob.metadata ?? {}),
          executionResult: result,
          executionCompletedAt: new Date().toISOString(),
          productionClaim: 'BLOCKED_UNTIL_CI_DEPLOYMENT_AND_PRODUCTION_FLOW_PROOF_PASS',
        },
      },
    });

    return NextResponse.json({ ok: true, data: { job: updated, execution: result } });
  } catch (error) {
    return fail(error);
  }
}
