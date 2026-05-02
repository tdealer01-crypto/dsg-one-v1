import { NextResponse } from 'next/server';
import { requireVerifiedDsgActor } from '@/lib/dsg/server/context';
import { createCompletionReport } from '@/lib/dsg/server/repository';
import { getBearerToken } from '@/lib/dsg/server/supabase-rpc';

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const actor = await requireVerifiedDsgActor(request.headers, 'replay:verify');
  const { jobId } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    reportHash?: string;
    evidenceManifestId?: string;
    auditExportId?: string;
    replayProofId?: string;
    deploymentProofId?: string | null;
    productionFlowProofId?: string | null;
    usesMockState?: boolean;
    isDevOrSmokeOnly?: boolean;
  } | null;

  if (!body?.reportHash || !body.evidenceManifestId || !body.auditExportId || !body.replayProofId) {
    return NextResponse.json({ ok: false, error: { code: 'DSG_COMPLETION_REQUIRED' } }, { status: 400 });
  }

  try {
    const data = await createCompletionReport(
      { workspaceId: actor.workspaceId, actorId: actor.actorId, userAccessToken: getBearerToken(request.headers) },
      {
        jobId,
        reportHash: body.reportHash,
        evidenceManifestId: body.evidenceManifestId,
        auditExportId: body.auditExportId,
        replayProofId: body.replayProofId,
        deploymentProofId: body.deploymentProofId,
        productionFlowProofId: body.productionFlowProofId,
        usesMockState: body.usesMockState,
        isDevOrSmokeOnly: body.isDevOrSmokeOnly,
      },
    );
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: { code: error instanceof Error ? error.message : 'DSG_COMPLETION_FAILED' } },
      { status: 403 },
    );
  }
}
