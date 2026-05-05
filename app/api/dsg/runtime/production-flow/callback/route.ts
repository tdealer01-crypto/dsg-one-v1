import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { callDsgRpc, getDsgSupabaseRpcConfig } from '@/lib/dsg/server/supabase-rpc';

export const runtime = 'nodejs';

type ProductionFlowPayload = {
  executionId?: string;
  jobId?: string;
  flowHash?: string;
  production_flow_passed?: boolean;
  steps?: unknown[];
  artifacts?: Record<string, unknown>;
  previewUrl?: string;
  gateHash?: string;
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-dsg-signature');

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json(
      { ok: false, error: { code: 'DSG_CALLBACK_SIGNATURE_INVALID' } },
      { status: 401 },
    );
  }

  const payload = JSON.parse(rawBody) as ProductionFlowPayload;

  if (!payload.jobId || !payload.flowHash) {
    return NextResponse.json(
      { ok: false, error: { code: 'DSG_PRODUCTION_FLOW_PAYLOAD_REQUIRED' } },
      { status: 400 },
    );
  }

  const status = payload.production_flow_passed === true ? 'PASS' : 'BLOCK';

  try {
    const id = await callDsgRpc<string>(getDsgSupabaseRpcConfig(), 'dsg_record_production_flow_proof', {
      p_job_id: payload.jobId,
      p_flow_name: 'dsg-production-flow',
      p_proof_hash: payload.flowHash,
      p_status: status,
      p_details: {
        executionId: payload.executionId,
        previewUrl: payload.previewUrl,
        gateHash: payload.gateHash,
        steps: payload.steps ?? [],
        artifacts: payload.artifacts ?? {},
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        id,
        status,
        proofHash: payload.flowHash,
      },
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: { code: error instanceof Error ? error.message : 'DSG_PRODUCTION_FLOW_CALLBACK_FAILED' } },
      { status: 500 },
    );
  }
}

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.DSG_CALLBACK_SECRET;
  if (!secret || !signature?.startsWith('sha256=')) return false;

  const expected = `sha256=${createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')}`;

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);

  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
