import { describe, expect, it } from 'vitest';
import { projectAutomationWorkQuest } from '@/lib/dsg/server/automation-spacetime';
import type { DsgRuntimeJobRecord } from '@/lib/dsg/server/repository';
import type { AutomationRunRecord, AutomationStepRecord } from '@/lib/dsg/server/automation-spacetime';

const viewer = { workspaceId: 'workspace-1', actorId: 'person-1' };
const job: DsgRuntimeJobRecord = {
  id: 'job-1', workspaceId: 'workspace-1', goal: 'Review deployment health',
  status: 'RUNNING', createdBy: 'person-1', createdAt: '2026-10-09T00:00:00Z',
};
const run: AutomationRunRecord = {
  id: 'run-1', jobId: 'job-1', workspaceId: 'workspace-1',
  taskPlanId: 'tasks-1', wavePlanId: 'waves-1', planHash: 'a'.repeat(64),
  waveHash: 'b'.repeat(64), planGraphHash: 'c'.repeat(64),
  engine: 'agent-framework', engineVersion: '1.18.0',
  workflowName: 'core-spin:job-1', status: 'RUNNING', currentCheckpointId: 'cp-1',
  currentIteration: 1, createdAt: '2026-10-09T00:00:00Z',
  updatedAt: '2026-10-09T00:01:00Z',
};
const steps: AutomationStepRecord[] = [
  { taskId: 'a', dependencies: [], status: 'COMPLETED', attempt: 1,
    assignedAgent: 'agent-proposal', nextRunAt: null, resultRef: 'hash-only' },
  { taskId: 'b', dependencies: ['a'], status: 'WAITING', attempt: 0,
    assignedAgent: null, nextRunAt: null, resultRef: 'approval-1' },
];

describe('existing Core Spin Job → Quest presentation', () => {
  it('uses real workflow status without inventing delegated Avatar identity', () => {
    const v = projectAutomationWorkQuest({ job, run, steps, viewer });
    expect(v).toMatchObject({
      schema: 'dsg.spacetime.work-quest-view.v1',
      source: 'dsg_automation_runs', jobId: 'job-1', runId: 'run-1',
      displayState: 'WAITING', creatorIsViewer: true,
      avatarBinding: 'NOT_BOUND', delegatedPrincipalBinding: 'NOT_VERIFIED',
      missionCompletion: 'NOT_VERIFIED',
      completionEvidence: 'NOT_INDEPENDENTLY_VERIFIED', executionAllowed: false,
    });
    expect(v.stepCounts.COMPLETED).toBe(1);
    expect(v.stepCounts.WAITING).toBe(1);
    expect(JSON.stringify(v)).not.toContain('agent-proposal');
  });
  it('does not promote completion from database status or result references', () => {
    const v=projectAutomationWorkQuest({
      job: {...job,status:'COMPLETED'},run: {...run,status:'COMPLETED'},
      steps: steps.map(x=>({...x,status:'COMPLETED'})), viewer,
    });
    expect(v.displayState).toBe('VERIFYING_EVIDENCE');
    expect(v.missionCompletion).toBe('NOT_VERIFIED');
    expect(v.completionEvidence).toBe('NOT_INDEPENDENTLY_VERIFIED');
  });
  it('does not create a mission when the automation run is absent', () => {
    const v=projectAutomationWorkQuest({job,run:null,steps:[],viewer});
    expect(v.displayState).toBe('NOT_STARTED');
    expect(v.runId).toBeNull();
  });
  it('rejects cross-workspace, cross-job, missing actor and invalid steps', () => {
    const input={job,run,steps,viewer};
    expect(()=>projectAutomationWorkQuest({...input,viewer:{...viewer,workspaceId:'foreign'}}))
      .toThrow('WORK_QUEST_WORKSPACE_MISMATCH');
    expect(()=>projectAutomationWorkQuest({...input,run:{...run,jobId:'foreign'}}))
      .toThrow('WORK_QUEST_JOB_MISMATCH');
    expect(()=>projectAutomationWorkQuest({...input,run:{...run,workspaceId:'foreign'}}))
      .toThrow('WORK_QUEST_WORKSPACE_MISMATCH');
    expect(()=>projectAutomationWorkQuest({...input,viewer:{...viewer,actorId:''}}))
      .toThrow('WORK_QUEST_VERIFIED_ACTOR_REQUIRED');
    expect(()=>projectAutomationWorkQuest({...input,run:null}))
      .toThrow('WORK_QUEST_STEPS_WITHOUT_RUN');
    expect(()=>projectAutomationWorkQuest({...input,steps:[{...steps[0],status:'UNKNOWN'}]}))
      .toThrow('WORK_QUEST_STEP_STATUS_UNRECOGNIZED');
  });
  it('redacts goal for a non-creator even with job:read permission', () => {
    const v=projectAutomationWorkQuest({job,run,steps,viewer:{...viewer,actorId:'reader-2'}});
    expect(v.creatorIsViewer).toBe(false);
    expect(v.goal).toBeNull();
  });
});
