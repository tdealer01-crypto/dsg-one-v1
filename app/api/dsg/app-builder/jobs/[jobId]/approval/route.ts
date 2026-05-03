import { NextResponse } from 'next/server';
import { approveAppBuilderPlan } from '@/lib/dsg/app-builder/approval';
import type { AppBuilderApprovalDecision } from '@/lib/dsg/app-builder/status';
import { getDevAppBuilderContext } from '@/lib/dsg/server/app-builder/context';
import { getAppBuilderJob, recordAppBuilderApproval, updateAppBuilderJob } from '@/lib/dsg/server/app-builder/repository';

function fail(error: unknown) {
  const code = error instanceof Error ? error.message : 'APP_BUILDER_APPROVAL_FAILED';
  return NextResponse.json({ ok: false, error: { code, message: code } }, { status: 400 });
}

export async function POST(req: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await context.params;
    const body = (await req.json()) as { decision: AppBuilderApprovalDecision; reason?: string };
    const ctx = getDevAppBuilderContext(req);
    const job = await getAppBuilderJob(ctx, jobId);

    if (!job.proposedPlan) throw new Error('APP_BUILDER_PLAN_REQUIRED');
    if (!job.gateResult) throw new Error('APP_BUILDER_GATE_RESULT_REQUIRED');
    if (job.gateResult.status === 'BLOCK' && body.decision === 'APPROVE') throw new Error('APP_BUILDER_GATE_BLOCKED');

    const approvedPlan = body.decision === 'APPROVE'
      ? approveAppBuilderPlan({ proposedPlan: job.proposedPlan, gateResult: job.gateResult, decision: body.decision, actorId: ctx.actorId })
      : undefined;

    await recordAppBuilderApproval({ ctx, jobId, decision: body.decision, reason: body.reason, approvedPlan, gateResult: job.gateResult });

    const status = body.decision === 'APPROVE' ? 'READY_FOR_RUNTIME' : body.decision === 'REJECT' ? 'REJECTED' : 'WAITING_APPROVAL';
    const updated = await updateAppBuilderJob({
      ctx,
      id: jobId,
      patch: {
        status,
        claim_status: body.decision === 'APPROVE' ? 'APPROVED_ONLY' : 'PLANNED_ONLY',
        approved_plan: approvedPlan ?? null,
        plan_hash: approvedPlan?.planHash ?? null,
        approval_hash: approvedPlan?.approvalHash ?? null,
      },
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    return fail(error);
  }
}
