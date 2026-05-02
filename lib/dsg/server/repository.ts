import type { RuntimeTask } from '../runtime/types';
import { callDsgRpc, getDsgSupabaseRpcConfig } from './supabase-rpc';

export type DsgRepositoryContext = {
  workspaceId: string;
  actorId: string;
  userAccessToken?: string;
};

export type DsgRuntimeJobRecord = {
  id: string;
  workspaceId: string;
  goal: string;
  status: string;
  createdBy: string;
  createdAt: string;
};

export function assertRepositoryContext(context: DsgRepositoryContext): void {
  if (!context.workspaceId) throw new Error('DSG_WORKSPACE_REQUIRED');
  if (!context.actorId) throw new Error('DSG_ACTOR_REQUIRED');
  if (!context.userAccessToken) throw new Error('DSG_USER_ACCESS_TOKEN_REQUIRED');
}

export async function createWorkspace(
  context: Omit<DsgRepositoryContext, 'workspaceId'>,
  input: { name: string; slug: string },
): Promise<string> {
  if (!context.actorId) throw new Error('DSG_ACTOR_REQUIRED');
  if (!context.userAccessToken) throw new Error('DSG_USER_ACCESS_TOKEN_REQUIRED');
  if (!input.name.trim() || !input.slug.trim()) throw new Error('DSG_WORKSPACE_INPUT_REQUIRED');

  return callDsgRpc<string>(getDsgSupabaseRpcConfig(context.userAccessToken), 'dsg_create_workspace', {
    p_name: input.name,
    p_slug: input.slug,
  });
}

export async function createRuntimeJob(
  context: DsgRepositoryContext,
  input: { goal: string; successCriteria?: unknown[] },
): Promise<{ id: string }> {
  assertRepositoryContext(context);
  if (!input.goal.trim()) throw new Error('DSG_GOAL_REQUIRED');

  const id = await callDsgRpc<string>(getDsgSupabaseRpcConfig(context.userAccessToken), 'dsg_create_runtime_job', {
    p_workspace_id: context.workspaceId,
    p_goal: input.goal,
    p_success_criteria: input.successCriteria ?? [],
  });

  return { id };
}

export async function createRuntimePlan(context: DsgRepositoryContext, input: { jobId: string; tasks: RuntimeTask[] }): Promise<never> {
  assertRepositoryContext(context);
  if (!input.jobId) throw new Error('DSG_JOB_REQUIRED');
  if (input.tasks.length === 0) throw new Error('DSG_TASKS_REQUIRED');
  throw new Error('DSG_PLAN_RPC_NOT_IMPLEMENTED');
}

export async function writeEvidence(
  context: DsgRepositoryContext,
  input: { jobId: string; evidenceType: string; contentHash: string; summary: string; uri?: string; metadata?: Record<string, unknown> },
): Promise<{ id: string }> {
  assertRepositoryContext(context);
  if (!input.jobId || !input.contentHash || !input.summary) throw new Error('DSG_EVIDENCE_REQUIRED');

  const id = await callDsgRpc<string>(getDsgSupabaseRpcConfig(context.userAccessToken), 'dsg_record_evidence', {
    p_job_id: input.jobId,
    p_evidence_type: input.evidenceType,
    p_content_hash: input.contentHash,
    p_summary: input.summary,
    p_uri: input.uri ?? null,
    p_metadata: input.metadata ?? {},
  });

  return { id };
}

export async function recordReplayProof(
  context: DsgRepositoryContext,
  input: { jobId: string; replayHash: string; status: 'PASS' | 'BLOCK' | 'FAILED'; details?: Record<string, unknown> },
): Promise<{ id: string }> {
  assertRepositoryContext(context);
  if (!input.jobId || !input.replayHash) throw new Error('DSG_REPLAY_REQUIRED');

  const id = await callDsgRpc<string>(getDsgSupabaseRpcConfig(context.userAccessToken), 'dsg_record_replay_proof', {
    p_job_id: input.jobId,
    p_replay_hash: input.replayHash,
    p_status: input.status,
    p_details: input.details ?? {},
  });

  return { id };
}
