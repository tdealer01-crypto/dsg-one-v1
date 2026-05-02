import { NextResponse } from 'next/server';
import { evaluateDsgClaimGate } from '@/lib/dsg/runtime/claim-gate';

export async function GET() {
  const claim = evaluateDsgClaimGate({
    hasEvidence: false,
    hasAuditExport: false,
    hasReplayProof: false,
    hasAuthRbacProof: false,
    hasDeploymentProof: false,
    hasProductionFlowProof: false,
    usesMockState: false,
    isDevOrSmokeOnly: true,
  });

  return NextResponse.json({ ok: true, data: { claim, production: false } });
}
