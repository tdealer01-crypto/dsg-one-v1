import { NextResponse } from 'next/server';
import { reviewAppBuilderPlan } from '@/lib/dsg/app-builder/ai-plan-review';
import { getAppBuilderRequestContext } from '@/lib/dsg/server/app-builder/context';
import { getAppBuilderJob, updateAppBuilderJob } from '@/lib/dsg/server/app-builder/repository';

function fail(error: unknown) {
  const code = error instanceof Error ? error.message : 'APP_BUILDER_PLAN_REVIEW_FAILED';
  const status = code.startsWith('DSG_') ? 401 : 400;
  return NextResponse.json({ ok: false, error: { code, message: code } }, { status });
}

export async function POST(req: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await context.params;
    const ctx = await getAppBuilderRequestContext(req, 'job:plan');
    const job = await getAppBuilderJob(ctx, jobId);
    const review = await reviewAppBuilderPlan(job);
    const status = review.status === 'PASS' ? job.status : review.status === 'BLOCK' ? 'BLOCKED' : 'PLAN_READY';

    const updated = await updateAppBuilderJob({
      ctx,
      id: jobId,
      patch: {
        status,
        metadata: {
          ...(job.metadata ?? {}),
          aiPlanReview: review,
          aiPlanReviewedAt: new Date().toISOString(),
        },
      },
    });

    return NextResponse.json({ ok: true, data: { job: updated, review } });
  } catch (error) {
    return fail(error);
  }
}
