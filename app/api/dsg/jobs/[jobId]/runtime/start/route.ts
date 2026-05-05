import { NextResponse } from 'next/server';
import { requireVerifiedDsgActor } from '@/lib/dsg/server/context';
import { getRuntimeJob, writeEvidence, createAuditExport, recordReplayProof } from '@/lib/dsg/server/repository';
import { getBearerToken } from '@/lib/dsg/server/supabase-rpc';
import { evaluateGatewayProof } from '@/lib/dsg/runtime/gateway-proof-bridge';
import { bindGatewayProofEvidence } from '@/lib/dsg/runtime/gateway-proof-evidence';

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const actor = await requireVerifiedDsgActor(request.headers, 'job:control');
  const { jobId } = await context.params;
  const repoCtx = { workspaceId: actor.workspaceId, actorId: actor.actorId, userAccessToken: getBearerToken(request.headers) };

  try {
    const job = await getRuntimeJob(repoCtx, jobId);
    const md = (job.metadata ?? {}) as Record<string, unknown>
    if (!md.approvedPlanHash || !md.gatewayPolicyRef) throw new Error('DSG_TRUSTED_GATE_METADATA_REQUIRED');
    if (md.gateSource !== 'server_verified') throw new Error('DSG_SERVER_VERIFIED_GATE_METADATA_REQUIRED');

    const proof = evaluateGatewayProof({
      hasOrg: Boolean(job.workspaceId),
      hasActor: Boolean(actor.actorId),
      hasActorRole: Boolean(actor.role),
      hasOrgPlan: Boolean(md.approvedPlanHash),
      isRegisteredTool: md.isRegisteredTool === true,
      actionMatchesTool: md.actionMatchesTool === true,
      actorRoleAllowed: md.actorRoleAllowed === true,
      planEntitled: md.planEntitled === true,
      risk: (job.riskLevel as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') ?? 'LOW',
      requiresApproval: md.requiresApproval === true,
      hasApproval: md.hasApproval === true,
      evidenceWritable: md.evidenceWritable === true,
      sourceRef: String(md.gatewayPolicyRef ?? 'unknown'),
    });

    const bundle = bindGatewayProofEvidence({ jobId, actorId: actor.actorId, gatewayProof: proof, previousAuditHash: String(md.previousAuditHash ?? '') || undefined });

    await writeEvidence(repoCtx, {
      jobId,
      evidenceType: bundle.evidence.evidenceType,
      contentHash: bundle.evidence.contentHash,
      summary: bundle.evidence.summary,
      metadata: { gatewayProof: proof, replayHash: bundle.replayHash },
    });
    await createAuditExport(repoCtx, { jobId, exportHash: bundle.auditEntry.currentHash });
    await recordReplayProof(repoCtx, {
      jobId,
      replayHash: bundle.replayHash,
      status: proof.decision === 'PASS' ? 'PASS' : 'BLOCK',
      details: { gatewayProof: proof },
    });

    if (proof.decision !== 'PASS') {
      return NextResponse.json({ ok: false, error: { code: 'DSG_RUNTIME_START_BLOCKED', violated: proof.violated, resultHash: proof.resultHash } }, { status: 403 });
    }

    return NextResponse.json({ ok: true, data: { status: 'START_ALLOWED', resultHash: proof.resultHash } }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: { code: error instanceof Error ? error.message : 'DSG_RUNTIME_START_FAILED' } }, { status: 403 });
  }
}
