import { NextResponse } from 'next/server';
import { getDsgActionLayerSnapshot } from '@/lib/dsg/action-layer/multi-flow-orchestrator';

export const dynamic = 'force-dynamic';

export async function GET() {
  const snapshot = getDsgActionLayerSnapshot();
  return NextResponse.json({
    ok: true,
    claim: snapshot.claim,
    proofHash: snapshot.proofHash,
    events: snapshot.recentActions.flatMap((action) => action.timeline),
  });
}
