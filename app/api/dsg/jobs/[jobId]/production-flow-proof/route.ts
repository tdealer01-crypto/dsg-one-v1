import { NextResponse } from 'next/server';
import { assertDsgPermission, devHeaderActor } from '@/lib/dsg/server/context';
import { recordProductionFlowProof } from '@/lib/dsg/server/repository';
import { getBearerToken } from '@/lib/dsg/server/supabase-rpc';

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const actor = assertDsgPermission(devHeaderActor(request.headers), 'production:write');
  const { jobId } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    flowName?: string;
    proofHash?: string;
    status?: 'PASS' | 'BLOCK' | 'FAILED';
    details?: Record<string, unknown>;
  } | null;

  if (!body?.flowName || !body.proofHash || !body.status) {
    return NextResponse.json({ ok: false, error: { code: 'DSG_PRODUCTION_FLOW_PROOF_REQUIRED' } }, { status: 400 });
  }

  try {
    const data = await recordProductionFlowProof(
      { workspaceId: actor.workspaceId, actorId: actor.actorId, userAccessToken: getBearerToken(request.headers) },
      { jobId, flowName: body.flowName, proofHash: body.proofHash, status: body.status, details: body.details },
    );
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: { code: error instanceof Error ? error.message : 'DSG_PRODUCTION_FLOW_PROOF_FAILED' } },
      { status: 403 },
    );
  }
}
