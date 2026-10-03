import { NextResponse } from 'next/server';
import { executeGovernedProposal } from '@/lib/dsg/core-spin/governed-execution';
import {
  normalizeXrReadIntentToCoreSpin,
  type CoreSpinXrIntentEnvelope,
} from '@/lib/dsg/core-spin/xr-intent';
import { toXrExecutionReceipt } from '@/lib/dsg/core-spin/xr-receipt';
import { requireVerifiedDsgActor } from '@/lib/dsg/server/context';

export async function POST(request: Request) {
  let actor;
  try {
    actor = await requireVerifiedDsgActor(request.headers, 'job:control');
  } catch (error) {
    const code = error instanceof Error ? error.message : 'DSG_AUTH_FAILED';
    const status = code === 'DSG_AUTH_REQUIRED' ? 401 : 403;
    return NextResponse.json(
      { status: 'BLOCK', verdict: 'BLOCK', reason: code },
      { status },
    );
  }

  try {
    const envelope = await request.json() as CoreSpinXrIntentEnvelope;
    const proposal = normalizeXrReadIntentToCoreSpin(envelope, {
      ownerId: actor.actorId,
      principal: `workspace:${actor.workspaceId}`,
    });
    const result = await executeGovernedProposal(proposal);

    return NextResponse.json(
      toXrExecutionReceipt(proposal, result),
      { status: result.state === 'FAILED' ? 502 : 200 },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : 'XR_CORE_SPIN_REJECTED';
    return NextResponse.json(
      { status: 'BLOCK', verdict: 'BLOCK', reason: code },
      { status: 400 },
    );
  }
}
