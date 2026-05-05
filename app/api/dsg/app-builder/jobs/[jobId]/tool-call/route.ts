import { NextResponse } from 'next/server';
import { callAppBuilderBuildTool, type AppBuilderToolCallInput } from '@/lib/dsg/app-builder/build-tools';
import { assertRuntimeGateReady } from '@/lib/dsg/app-builder/runtime-gate-snapshot';
import { getDevAppBuilderContext } from '@/lib/dsg/server/app-builder/context';
import { getAppBuilderJob, recordAppBuilderToolAudit, updateAppBuilderJob } from '@/lib/dsg/server/app-builder/repository';

export const runtime = 'nodejs';

function fail(error: unknown) {
  const code = error instanceof Error ? error.message : 'APP_BUILDER_TOOL_CALL_FAILED';
  return NextResponse.json({ ok: false, error: { code, message: code } }, { status: 400 });
}

export async function POST(req: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await context.params;
    const body = (await req.json()) as AppBuilderToolCallInput;
    const ctx = getDevAppBuilderContext(req);
    const job = await getAppBuilderJob(ctx, jobId);

    const runtimeGate = await assertRuntimeGateReady(job);

    await updateAppBuilderJob({
      ctx,
      id: jobId,
      patch: {
        status: 'EXECUTING',
        claim_status: 'APPROVED_ONLY',
        metadata: {
          ...(job.metadata ?? {}),
          runtimeGate: {
            status: runtimeGate.status,
            gateHash: runtimeGate.gateHash,
            evaluatedAt: runtimeGate.evaluatedAt,
          },
          toolCallStartedAt: new Date().toISOString(),
          requestedTool: body.toolName,
        },
      },
    });

    const freshJob = await getAppBuilderJob(ctx, jobId);
    const result = await callAppBuilderBuildTool(freshJob, body);

    await recordAppBuilderToolAudit({
      ctx,
      jobId,
      toolName: result.toolName,
      outcome: result.auditEvent.outcome,
      evidenceRefs: result.auditEvent.evidenceRefs,
      auditEvent: {
        ...(result.auditEvent as unknown as Record<string, unknown>),
        runtimeGate: {
          status: runtimeGate.status,
          gateHash: runtimeGate.gateHash,
          evaluatedAt: runtimeGate.evaluatedAt,
          snapshot: runtimeGate.snapshot,
        },
      },
    });

    const updated = await updateAppBuilderJob({
      ctx,
      id: jobId,
      patch: {
        status: 'PR_CREATED',
        claim_status: result.claimStatus,
        metadata: {
          ...(freshJob.metadata ?? {}),
          runtimeGate: {
            status: runtimeGate.status,
            gateHash: runtimeGate.gateHash,
            evaluatedAt: runtimeGate.evaluatedAt,
          },
          toolCallResult: result,
          executionResult: result.output,
          toolCallCompletedAt: new Date().toISOString(),
          productionClaim: 'BLOCKED_UNTIL_CI_DEPLOYMENT_AND_PRODUCTION_FLOW_PROOF_PASS',
        },
      },
    });

    return NextResponse.json({ ok: true, data: { job: updated, runtimeGate, toolCall: result } });
  } catch (error) {
    return fail(error);
  }
}
