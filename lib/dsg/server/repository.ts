import type { RuntimeTask } from '../runtime/types';

export type DsgRepositoryContext = {
  workspaceId: string;
  actorId: string;
};

export type DsgRuntimeJobRecord = {
  id: string;
  workspaceId: string;
  goal: string;
  status: string;
  createdBy: string;
  createdAt: string;
};

const repositoryNotice = 'DSG_REPOSITORY_REQUIRES_SUPABASE_CLIENT';

export function assertRepositoryContext(context: DsgRepositoryContext): void {
  if (!context.workspaceId) throw new Error('DSG_WORKSPACE_REQUIRED');
  if (!context.actorId) throw new Error('DSG_ACTOR_REQUIRED');
}

export async function createRuntimeJob(context: DsgRepositoryContext, input: { goal: string }): Promise<DsgRuntimeJobRecord> {
  assertRepositoryContext(context);
  if (!input.goal.trim()) throw new Error('DSG_GOAL_REQUIRED');
  throw new Error(repositoryNotice);
}

export async function createRuntimePlan(context: DsgRepositoryContext, input: { jobId: string; tasks: RuntimeTask[] }): Promise<never> {
  assertRepositoryContext(context);
  if (!input.jobId) throw new Error('DSG_JOB_REQUIRED');
  if (input.tasks.length === 0) throw new Error('DSG_TASKS_REQUIRED');
  throw new Error(repositoryNotice);
}

export async function writeEvidence(context: DsgRepositoryContext, input: { jobId: string; contentHash: string; summary: string }): Promise<never> {
  assertRepositoryContext(context);
  if (!input.jobId || !input.contentHash || !input.summary) throw new Error('DSG_EVIDENCE_REQUIRED');
  throw new Error(repositoryNotice);
}
