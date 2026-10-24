import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireVerifiedDsgActor, getDsgUserAccessToken,
  getRuntimeJob, getLatestAutomationRun, getAutomationSteps } = vi.hoisted(() => ({
  requireVerifiedDsgActor: vi.fn(),
  getDsgUserAccessToken: vi.fn(),
  getRuntimeJob: vi.fn(),
  getLatestAutomationRun: vi.fn(),
  getAutomationSteps: vi.fn(),
}));
vi.mock('@/lib/dsg/server/context', () => ({
  requireVerifiedDsgActor, getDsgUserAccessToken,
}));
vi.mock('@/lib/dsg/server/repository', () => ({ getRuntimeJob }));
vi.mock('@/lib/dsg/server/automation-spacetime', async (importOriginal) => ({
  ...await importOriginal(),
  getLatestAutomationRun, getAutomationSteps,
}));
import { GET } from '../../app/api/dsg/jobs/[jobId]/automation/route';

const job = {
  id: 'job-1', workspaceId: 'workspace-1',
  goal: 'Repair production health with evidence', status: 'RUNNING',
  createdBy: 'actor-1', createdAt: '2026-10-09T00:00:00Z',
};
const run = {
  id: 'run-1', jobId: 'job-1', workspaceId: 'workspace-1',
  planHash: 'a'.repeat(64), taskPlanId: 'plan-1', wavePlanId: 'wave-1',
  status: 'RUNNING', workflowName: 'core-spin:job-1',
};
const request = () => new Request('http://localhost/api/dsg/jobs/job-1/automation', {
  headers: { Authorization: 'Bearer test-token', 'x-dsg-workspace-id': 'workspace-1' },
});
const context = { params: Promise.resolve({ jobId: 'job-1' }) };

describe('GET /api/dsg/jobs/[jobId]/automation work-Quest extension', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireVerifiedDsgActor.mockResolvedValue({
      workspaceId:'workspace-1',actorId:'actor-1',role:'OWNER',
    });
    getDsgUserAccessToken.mockReturnValue('test-token');
    getRuntimeJob.mockResolvedValue(job);
    getLatestAutomationRun.mockResolvedValue(run);
    getAutomationSteps.mockResolvedValue([{
      taskId:'a',status:'WAITING',dependencies:[],attempt:0,
      assignedAgent:'agent-1',resultRef:'approval-1',nextRunAt:null,
    }]);
  });
  it('uses the existing job:read verified actor, returns unchanged run/steps plus view', async () => {
    const res=await GET(request(),context);
    const json=await res.json();
    expect(res.status).toBe(200);
    expect(requireVerifiedDsgActor).toHaveBeenCalledWith(expect.any(Headers),'job:read');
    expect(getRuntimeJob).toHaveBeenCalledWith({
      workspaceId:'workspace-1',actorId:'actor-1',userAccessToken:'test-token',
    },'job-1');
    expect(json.data.workQuest).toMatchObject({
      jobId:'job-1',runId:'run-1',displayState:'WAITING',
      avatarBinding:'NOT_BOUND',delegatedPrincipalBinding:'NOT_VERIFIED',
      completionEvidence:'NOT_INDEPENDENTLY_VERIFIED',executionAllowed:false,
    });
    expect(json.data.run).toEqual(run);
    expect(json.data.steps).toHaveLength(1);
  });
  it('requires an existing authorized Job even when no automation run exists', async () => {
    getLatestAutomationRun.mockResolvedValue(null);
    const res=await GET(request(),context);
    expect((await res.json()).data.workQuest.displayState).toBe('NOT_STARTED');
    expect(getRuntimeJob).toHaveBeenCalled();
    expect(getAutomationSteps).not.toHaveBeenCalled();
  });
  it('blocks nonexistent jobs and mismatched workspace of run', async () => {
    getRuntimeJob.mockRejectedValueOnce(new Error('DSG_JOB_NOT_FOUND'));
    const missing=await GET(request(),context);
    expect(missing.status).toBe(403);
    expect((await missing.json()).error.code).toBe('DSG_JOB_NOT_FOUND');
    getLatestAutomationRun.mockResolvedValueOnce({...run,workspaceId:'foreign'});
    const foreign=await GET(request(),context);
    expect(foreign.status).toBe(403);
    expect((await foreign.json()).error.code).toBe('WORK_QUEST_WORKSPACE_MISMATCH');
  });
  it('does not leak goal in the projected view to a different job reader', async () => {
    requireVerifiedDsgActor.mockResolvedValue({
      workspaceId:'workspace-1',actorId:'reader',role:'VIEWER',
    });
    const res=await GET(request(),context);
    expect((await res.json()).data.workQuest.goal).toBeNull();
  });
});
