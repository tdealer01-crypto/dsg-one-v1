import { NextResponse } from 'next/server';
import { executeGovernedProposal } from '@/lib/dsg/core-spin/governed-execution';
import {
  normalizeXrReadIntentToCoreSpin,
  type CoreSpinXrIntentEnvelope,
} from '@/lib/dsg/core-spin/xr-intent';
import { requireVerifiedDsgActor } from '@/lib/dsg/server/context';

function receiptStatus(state: string) {
  if (state === 'COMPLETED') return { status: 'EXECUTED', verdict: 'ALLOW' };
  if (state === 'WAITING_APPROVAL') return { status: 'WAITING_APPROVAL', verdict: 'PENDING' };
  if (state === 'BLOCKED') return { status: 'BLOCK', verdict: 'BLOCK' };
  return { status: 'FAILED', verdict: 'BLOCK' };
}

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
      workspaceId: actor.workspaceId,
    });
    const result = await executeGovernedProposal(proposal);
    const receipt = receiptStatus(result.state);

    return NextResponse.json({
      ...receipt,
      reason: result.reason ?? '',
      plan_id: proposal.planId,
      route_id: result.routeId ?? proposal.routeId,
      approval_request_id: result.approvalRequestId ?? '',
      result: result.result ?? null,
      evidence: result.evidence ?? null,
      execution_authority: 'dsg-spacetime',
      orchestration_authority: 'dsg-core-spin',
      direct_provider_access: false,
    }, {
      status: result.state === 'FAILED' ? 502 : 200,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'XR_CORE_SPIN_REJECTED';
    return NextResponse.json(
      { status: 'BLOCK', verdict: 'BLOCK', reason: code },
      { status: 400 },
    );
  }
}
