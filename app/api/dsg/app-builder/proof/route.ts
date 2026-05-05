import { NextResponse } from 'next/server';
import { createAppBuilderFlowProof } from '@/lib/dsg/app-builder/proof/create-flow-proof';

const DEFAULT_GOAL = 'Build a CRM dashboard for small teams with contacts, tasks, notes, and workspace roles.';

export async function GET() {
  const proof = createAppBuilderFlowProof(DEFAULT_GOAL);
  return NextResponse.json(proof);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const goal = typeof body.goal === 'string' && body.goal.trim().length >= 8 ? body.goal : DEFAULT_GOAL;
    const proof = createAppBuilderFlowProof(goal);
    return NextResponse.json(proof);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'APP_BUILDER_FLOW_PROOF_FAILED';
    return NextResponse.json(
      {
        ok: false,
        status: 'BLOCK',
        error: { code: message, message },
        claimBoundary: {
          claimStatus: 'APP_BUILDER_FLOW_PROOF_BLOCKED',
          productReadyClaim: false,
          manusLevelClaim: false,
          productionReadyClaim: false,
        },
      },
      { status: 500 },
    );
  }
}
