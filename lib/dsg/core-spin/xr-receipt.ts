import type {
  CoreSpinActionProposal,
  CoreSpinExecutionResult,
} from './governed-execution';

function receiptState(state: CoreSpinExecutionResult['state']) {
  if (state === 'COMPLETED') return { status: 'EXECUTED', verdict: 'ALLOW' };
  if (state === 'WAITING_APPROVAL') {
    return { status: 'WAITING_APPROVAL', verdict: 'PENDING' };
  }
  if (state === 'BLOCKED') return { status: 'BLOCK', verdict: 'BLOCK' };
  return { status: 'FAILED', verdict: 'BLOCK' };
}

export function toXrExecutionReceipt(
  proposal: CoreSpinActionProposal,
  result: CoreSpinExecutionResult,
) {
  return {
    ...receiptState(result.state),
    reason: result.reason ?? '',
    plan_id: proposal.planId,
    plan_hash: result.planHash ?? null,
    route_id: result.routeId ?? proposal.routeId ?? '',
    approval_request_id: result.approvalRequestId ?? '',
    result: result.result ?? null,
    evidence: result.evidence ?? null,
    execution_authority: 'dsg-spacetime',
    orchestration_authority: 'dsg-core-spin',
    direct_provider_access: false,
  };
}
