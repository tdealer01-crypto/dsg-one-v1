import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callSpacetimeTool } = vi.hoisted(() => ({
  callSpacetimeTool: vi.fn(),
}));
vi.mock('@/lib/dsg/spacetime/client', () => ({
  callSpacetimeTool,
}));

import { executeGovernedProposal } from '../../lib/dsg/core-spin/governed-execution';

const baseProposal = {
  taskId: 'inspect',
  planId: 'plan-1',
  intent: 'Inspect governed browser state',
  capability: 'browser.remote.status',
  agentId: 'dsg-core-spin',
  principal: 'workspace:ws-1',
};

describe('executeGovernedProposal', () => {
  beforeEach(() => {
    callSpacetimeTool.mockReset();
  });

  it('executes a read-only route and verifies evidence before completing', async () => {
    callSpacetimeTool
      .mockResolvedValueOnce({
        routes: [{
          route_id: 'route.cinema-remote.status',
          source_node: 'node.agent',
          target_node: 'node.cinema-remote',
          capability: 'browser.remote.status',
          approval_required: false,
          bind_payload: false,
        }],
      })
      .mockResolvedValueOnce({ verdict: 'BOUND', plan_hash: 'a'.repeat(64) })
      .mockResolvedValueOnce({
        decision: { verdict: 'ALLOW', decision_hash: 'b'.repeat(64) },
        result: { connected: true },
        evidence: { evidence_hash: 'c'.repeat(64) },
      })
      .mockResolvedValueOnce({ valid: true, records: 1 });

    const result = await executeGovernedProposal(baseProposal);

    expect(result.state).toBe('COMPLETED');
    expect(result.routeId).toBe('route.cinema-remote.status');
    expect(result.evidenceChain).toMatchObject({ valid: true });
    expect(callSpacetimeTool.mock.calls.map(([name]) => name)).toEqual([
      'spacetime_discover',
      'spacetime_compose',
      'spacetime_execute',
      'spacetime_verify_evidence',
    ]);
  });

  it('stops at exact-request approval before a high-risk route executes', async () => {
    callSpacetimeTool
      .mockResolvedValueOnce({
        routes: [{
          route_id: 'route.cinema-remote.connect',
          source_node: 'node.agent',
          target_node: 'node.cinema-remote',
          capability: 'browser.remote.connect',
          approval_required: true,
          signed_approval_required: true,
          bind_payload: true,
        }],
      })
      .mockResolvedValueOnce({ verdict: 'BOUND', plan_hash: 'd'.repeat(64) })
      .mockResolvedValueOnce({
        verdict: 'PENDING',
        approval: { approval_request_id: 'approval-1' },
      });

    const result = await executeGovernedProposal({
      ...baseProposal,
      capability: 'browser.remote.connect',
      payload: {
        action: 'browser.remote.connect',
        arguments: {
          plan_id: 'plan-1',
          agent_identity: 'dsg-core-spin',
          step_id: 'inspect',
          ttl_seconds: 600,
        },
      },
    });

    expect(result).toMatchObject({
      state: 'WAITING_APPROVAL',
      approvalRequestId: 'approval-1',
    });
    expect(callSpacetimeTool).toHaveBeenCalledTimes(3);
    expect(callSpacetimeTool).not.toHaveBeenCalledWith(
      'spacetime_execute',
      expect.anything(),
    );
  });

  it('resumes an approved request and passes the ephemeral approval token to execute', async () => {
    callSpacetimeTool
      .mockResolvedValueOnce({
        routes: [{
          route_id: 'route.cinema-remote.connect',
          source_node: 'node.agent',
          target_node: 'node.cinema-remote',
          capability: 'browser.remote.connect',
          approval_required: true,
          signed_approval_required: true,
          bind_payload: true,
        }],
      })
      .mockResolvedValueOnce({
        verdict: 'APPROVED',
        approval_id: 'signed-approval-token',
        approval: {
          approval_request_id: 'approval-1',
          plan_id: 'plan-1',
          plan_hash: 'e'.repeat(64),
          route_id: 'route.cinema-remote.connect',
          agent_id: 'dsg-core-spin',
        },
      })
      .mockResolvedValueOnce({
        decision: { verdict: 'ALLOW', decision_hash: 'f'.repeat(64) },
        result: { connected: true },
        evidence: { evidence_hash: '1'.repeat(64) },
      })
      .mockResolvedValueOnce({ valid: true, records: 2 });

    const result = await executeGovernedProposal({
      ...baseProposal,
      capability: 'browser.remote.connect',
      payload: {
        action: 'browser.remote.connect',
        arguments: {
          plan_id: 'plan-1',
          agent_identity: 'dsg-core-spin',
          step_id: 'inspect',
          ttl_seconds: 600,
        },
      },
      approvalRequestId: 'approval-1',
      approvalDecision: 'APPROVE',
    });

    expect(result.state).toBe('COMPLETED');
    const executeCall = callSpacetimeTool.mock.calls.find(
      ([name]) => name === 'spacetime_execute',
    );
    expect(executeCall?.[1]).toMatchObject({
      approval_id: 'signed-approval-token',
      plan_hash: 'e'.repeat(64),
    });
    expect(callSpacetimeTool.mock.calls.map(([name]) => name)).not.toContain(
      'spacetime_compose',
    );
  });
});
