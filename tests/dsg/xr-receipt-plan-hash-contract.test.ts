import { describe, expect, it } from 'vitest';
import { toXrExecutionReceipt } from '@/lib/dsg/core-spin/xr-receipt';
import type {
  CoreSpinActionProposal,
  CoreSpinExecutionResult,
} from '@/lib/dsg/core-spin/governed-execution';

const PLAN_HASH = 'a'.repeat(64);
const REQUEST_HASH = 'b'.repeat(64);
const DECISION_HASH = 'c'.repeat(64);

const proposal: CoreSpinActionProposal = {
  taskId: 'xr-read-task',
  planId: 'xr-html-xr-read-test',
  intent: 'Authorized READ_REGION on ai-commons',
  capability: 'world.read',
  routeId: 'route.xr-world.read',
  agentId: 'html-visitor',
  principal: 'oauth:verified-subject',
};

describe('Core Spin XR HTTP receipt plan hash contract', () => {
  it('preserves the authoritative compose plan hash in the top-level ALLOW receipt', () => {
    const result: CoreSpinExecutionResult = {
      state: 'COMPLETED',
      routeId: proposal.routeId,
      planHash: PLAN_HASH,
      result: {
        ok: true,
        action: 'READ_REGION',
        request_hash: REQUEST_HASH,
        execution_binding: {
          plan_id: proposal.planId,
          plan_hash: PLAN_HASH,
          route_id: proposal.routeId,
          agent_id: proposal.agentId,
          decision_hash: DECISION_HASH,
        },
      },
      evidence: {
        plan_id: proposal.planId,
        route_id: proposal.routeId,
        agent_id: proposal.agentId,
        request_hash: REQUEST_HASH,
        decision_hash: DECISION_HASH,
      },
    };
    const receipt = toXrExecutionReceipt(proposal, result);

    expect(receipt.status).toBe('EXECUTED');
    expect(receipt.verdict).toBe('ALLOW');
    expect(receipt.plan_id).toBe(proposal.planId);
    expect(receipt.plan_hash).toBe(PLAN_HASH);
    expect(receipt.plan_hash).toBe(
      (receipt.result as typeof result.result & {
        execution_binding: { plan_hash: string };
      }).execution_binding.plan_hash,
    );
    expect(receipt.direct_provider_access).toBe(false);
  });

  it('does not invent a missing plan hash even when a nested result advertises one', () => {
    const result: CoreSpinExecutionResult = {
      state: 'COMPLETED',
      result: {
        ok: true,
        execution_binding: { plan_hash: PLAN_HASH },
      },
    };
    const receipt = toXrExecutionReceipt(proposal, result);

    expect(receipt.plan_hash).toBeNull();
    // The Software XR Monitor must reject this receipt as RESULT_NOT_VERIFIED.
  });

  it('retains plan binding metadata on approval-required responses', () => {
    const receipt = toXrExecutionReceipt(proposal, {
      state: 'WAITING_APPROVAL',
      planHash: PLAN_HASH,
      approvalRequestId: 'approval-request-example',
    });

    expect(receipt.status).toBe('WAITING_APPROVAL');
    expect(receipt.verdict).toBe('PENDING');
    expect(receipt.plan_hash).toBe(PLAN_HASH);
    expect(receipt.approval_request_id).toBe('approval-request-example');
  });
});
