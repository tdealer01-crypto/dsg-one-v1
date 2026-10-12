import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  probe: vi.fn(),
  authorize: vi.fn(),
}));

vi.mock('@/lib/dsg/core-spin/governed-execution', () => ({ executeGovernedProposal: mocks.execute }));
vi.mock('@/lib/dsg/server/automation-spacetime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/dsg/server/automation-spacetime')>()),
  probeAutomationEngine: mocks.probe,
}));
vi.mock('@/lib/dsg/server/context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/dsg/server/context')>()),
  requireVerifiedDsgActor: mocks.authorize,
}));

import { POST as agentExecute } from '@/app/api/agent/execute/route';
import { POST as automation } from '@/app/api/dsg/jobs/[jobId]/automation/route';

const json = (path: string, body: Record<string, unknown>) =>
  new Request(`https://dsg.pics${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.authorize.mockResolvedValue({ actorId: 'operator-1', workspaceId: 'ws-1', role: 'OPERATOR' });
  mocks.probe.mockResolvedValue({ ok: true, engine: 'microsoft-agent-framework', version: '1.18.0' });
  mocks.execute.mockResolvedValue({ state: 'BLOCKED', routeId: 'route.cinema-remote.execute' });
});

// An approval made by the person (Auth0 approver login + MFA, /dsg/approvals) is the human gate.
// These routes resolve approvals with the server's own credential, so they must never take an APPROVE from a client.
describe('human approval cannot be self-granted through the execution routes', () => {
  const executeBody = (decision?: string) => ({
    capability: 'browser.remote.execute',
    payload: { action: 'browser.remote.run', arguments: { url: 'https://example.com' } },
    approvalRequestId: 'approval-1',
    ...(decision ? { approvalDecision: decision } : {}),
  });

  it('agent/execute: approvalDecision=APPROVE is refused with 403 before anything is executed', async () => {
    const res = await agentExecute(json('/api/agent/execute', executeBody('APPROVE')));
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error.code).toBe('DSG_HUMAN_APPROVAL_REQUIRED');
    expect(body.error.nextAction).toContain('/dsg/approvals');
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.probe).not.toHaveBeenCalled();
  });

  it('agent/execute: REJECT is still allowed (rejecting is the safe direction) and no decision is unchanged', async () => {
    await agentExecute(json('/api/agent/execute', executeBody('REJECT')));
    expect(mocks.execute).toHaveBeenCalledWith(expect.objectContaining({ approvalDecision: 'REJECT' }));
    mocks.execute.mockClear();
    await agentExecute(json('/api/agent/execute', executeBody()));
    expect(mocks.execute).toHaveBeenCalledWith(expect.objectContaining({ approvalDecision: undefined }));
  });

  it('jobs/[jobId]/automation: APPROVE on EXECUTE is refused with 403 before any state is read', async () => {
    const res = await automation(
      json('/api/dsg/jobs/job-1/automation', { action: 'EXECUTE', taskId: 't1', capability: 'browser.remote.execute', approvalDecision: 'APPROVE' }),
      { params: Promise.resolve({ jobId: 'job-1' }) },
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('DSG_HUMAN_APPROVAL_REQUIRED');
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});
