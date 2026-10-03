import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeGovernedProposal, probeAutomationEngine, requireVerifiedDsgActor } = vi.hoisted(() => ({
  executeGovernedProposal: vi.fn(),
  probeAutomationEngine: vi.fn(),
  requireVerifiedDsgActor: vi.fn(),
}));

vi.mock('@/lib/dsg/core-spin/governed-execution', () => ({
  executeGovernedProposal,
}));

vi.mock('@/lib/dsg/server/automation-spacetime', () => ({
  probeAutomationEngine,
}));

vi.mock('@/lib/dsg/server/context', () => ({
  requireVerifiedDsgActor,
}));

import { POST } from '../../app/api/agent/execute/route';

function request(body: Record<string, unknown>) {
  return new Request('http://localhost/api/agent/execute', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/agent/execute', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireVerifiedDsgActor.mockResolvedValue({
      actorId: 'actor-1',
      workspaceId: 'workspace-1',
      role: 'OWNER',
    });
    probeAutomationEngine.mockResolvedValue({
      ok: true,
      engine: 'microsoft-agent-framework',
      version: '1.18.0',
    });
  });

  it('executes the read-only Cinema browser status route through Core Spin', async () => {
    executeGovernedProposal.mockResolvedValue({
      state: 'COMPLETED',
      routeId: 'route.cinema-remote.status',
      planHash: 'a'.repeat(64),
      decision: { verdict: 'ALLOW' },
      result: { connected: true },
      evidenceChain: { valid: true },
    });

    const response = await POST(request({
      taskId: 'browser-status',
      planId: 'plan-browser-status',
      intent: 'Read Cinema browser status',
      capability: 'browser.remote.status',
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.executionAuthority).toBe('dsg-spacetime');
    expect(payload.data.automationEngine).toMatchObject({
      engine: 'microsoft-agent-framework',
      version: '1.18.0',
    });
    expect(executeGovernedProposal).toHaveBeenCalledWith({
      taskId: 'browser-status',
      planId: 'plan-browser-status',
      intent: 'Read Cinema browser status',
      capability: 'browser.remote.status',
      routeId: 'route.cinema-remote.status',
      payload: undefined,
      agentId: 'dsg-agent-runtime',
      principal: 'workspace:workspace-1',
      approvalRequestId: undefined,
      approvalDecision: undefined,
    });
  });

  it('returns WAITING_APPROVAL for a governed browser execution', async () => {
    executeGovernedProposal.mockResolvedValue({
      state: 'WAITING_APPROVAL',
      routeId: 'route.cinema-remote.execute',
      planHash: 'b'.repeat(64),
      approvalRequestId: 'approval-browser-1',
    });

    const response = await POST(request({
      taskId: 'browser-run',
      planId: 'plan-browser-run',
      capability: 'browser.remote.execute',
      payload: {
        action: 'browser.remote.run',
        arguments: { url: 'https://example.com' },
      },
    }));
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload.ok).toBe(true);
    expect(payload.data.result).toMatchObject({
      state: 'WAITING_APPROVAL',
      approvalRequestId: 'approval-browser-1',
    });
  });

  it('fails closed when a caller attempts to substitute another route', async () => {
    const response = await POST(request({
      capability: 'browser.remote.execute',
      routeId: 'route.other.execute',
      payload: { action: 'browser.remote.run', arguments: {} },
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('AGENT_BROWSER_ROUTE_MISMATCH');
    expect(executeGovernedProposal).not.toHaveBeenCalled();
  });

  it('requires verified job-control identity', async () => {
    requireVerifiedDsgActor.mockRejectedValueOnce(new Error('DSG_AUTH_REQUIRED'));

    const response = await POST(request({
      capability: 'browser.remote.status',
    }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe('DSG_AUTH_REQUIRED');
    expect(probeAutomationEngine).not.toHaveBeenCalled();
    expect(executeGovernedProposal).not.toHaveBeenCalled();
  });
});
