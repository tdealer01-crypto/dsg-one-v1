import { NextResponse } from 'next/server';
import { requireVerifiedDsgActor } from '@/lib/dsg/server/context';
import { recordDeploymentProof } from '@/lib/dsg/server/repository';
import { getBearerToken } from '@/lib/dsg/server/supabase-rpc';

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const actor = await requireVerifiedDsgActor(request.headers, 'deployment:write');
  const { jobId } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    environment?: string;
    deploymentUrl?: string;
    proofHash?: string;
    status?: 'PASS' | 'BLOCK' | 'FAILED';
    details?: Record<string, unknown>;
  } | null;

  if (!body?.environment || !body.deploymentUrl || !body.proofHash || !body.status) {
    return NextResponse.json({ ok: false, error: { code: 'DSG_DEPLOYMENT_PROOF_REQUIRED' } }, { status: 400 });
  }

  try {
    const data = await recordDeploymentProof(
      { workspaceId: actor.workspaceId, actorId: actor.actorId, userAccessToken: getBearerToken(request.headers) },
      {
        jobId,
        environment: body.environment,
        deploymentUrl: body.deploymentUrl,
        proofHash: body.proofHash,
        status: body.status,
        details: body.details,
      },
    );
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: { code: error instanceof Error ? error.message : 'DSG_DEPLOYMENT_PROOF_FAILED' } },
      { status: 403 },
    );
  }
}
