import { createRuntimePlan as buildRuntimePlan } from '../runtime/planner';
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

export async function createRuntimePlan(
  context: DsgRepositoryContext,
  input: { jobId: string; tasks: RuntimeTask[] },
): Promise<{ taskPlanId: string; wavePlanId: string; planHash: string; waveHash: string }> {
  assertRepositoryContext(context);
  if (!input.jobId) throw new Error('DSG_JOB_REQUIRED');
  const plan = buildRuntimePlan(input.tasks);

  const data = await callDsgRpc<{ taskPlanId: string; wavePlanId: string }>(
    getDsgSupabaseRpcConfig(context.userAccessToken),
    'dsg_create_plan',
    {
      p_job_id: input.jobId,
      p_plan_hash: plan.planHash,
      p_tasks: plan.tasks,
      p_dependency_edges: plan.edges,
      p_wave_hash: plan.waveHash,
      p_waves: plan.waves,
    },
  );

  return { ...data, planHash: plan.planHash, waveHash: plan.waveHash };
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

export async function createEvidenceManifest(
  context: DsgRepositoryContext,
  input: { jobId: string; manifestHash: string; evidenceIds: string[] },
): Promise<{ id: string }> {
  assertRepositoryContext(context);
  if (!input.jobId || !input.manifestHash || input.evidenceIds.length === 0) throw new Error('DSG_MANIFEST_REQUIRED');

  const id = await callDsgRpc<string>(getDsgSupabaseRpcConfig(context.userAccessToken), 'dsg_create_evidence_manifest', {
    p_job_id: input.jobId,
    p_manifest_hash: input.manifestHash,
    p_evidence_ids: input.evidenceIds,
  });

  return { id };
}

export async function createAuditExport(
  context: DsgRepositoryContext,
  input: { jobId: string; exportHash: string },
): Promise<{ id: string }> {
  assertRepositoryContext(context);
  if (!input.jobId || !input.exportHash) throw new Error('DSG_AUDIT_EXPORT_REQUIRED');

  const id = await callDsgRpc<string>(getDsgSupabaseRpcConfig(context.userAccessToken), 'dsg_create_audit_export', {
    p_job_id: input.jobId,
    p_export_hash: input.exportHash,
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

export async function recordDeploymentProof(
  context: DsgRepositoryContext,
  input: { jobId: string; environment: string; deploymentUrl: string; proofHash: string; status: 'PASS' | 'BLOCK' | 'FAILED'; details?: Record<string, unknown> },
): Promise<{ id: string }> {
  assertRepositoryContext(context);
  if (!input.jobId || !input.environment || !input.deploymentUrl || !input.proofHash) throw new Error('DSG_DEPLOYMENT_PROOF_REQUIRED');

  const id = await callDsgRpc<string>(getDsgSupabaseRpcConfig(context.userAccessToken), 'dsg_record_deployment_proof', {
    p_job_id: input.jobId,
    p_environment: input.environment,
    p_deployment_url: input.deploymentUrl,
    p_proof_hash: input.proofHash,
    p_status: input.status,
    p_details: input.details ?? {},
  });

  return { id };
}

export async function recordProductionFlowProof(
  context: DsgRepositoryContext,
  input: { jobId: string; flowName: string; proofHash: string; status: 'PASS' | 'BLOCK' | 'FAILED'; details?: Record<string, unknown> },
): Promise<{ id: string }> {
  assertRepositoryContext(context);
  if (!input.jobId || !input.flowName || !input.proofHash) throw new Error('DSG_PRODUCTION_FLOW_PROOF_REQUIRED');

  const id = await callDsgRpc<string>(getDsgSupabaseRpcConfig(context.userAccessToken), 'dsg_record_production_flow_proof', {
    p_job_id: input.jobId,
    p_flow_name: input.flowName,
    p_proof_hash: input.proofHash,
    p_status: input.status,
    p_details: input.details ?? {},
  });

  return { id };
}

export async function createCompletionReport(
  context: DsgRepositoryContext,
  input: {
    jobId: string;
    reportHash: string;
    evidenceManifestId: string;
    auditExportId: string;
    replayProofId: string;
    deploymentProofId?: string | null;
    productionFlowProofId?: string | null;
    usesMockState?: boolean;
    isDevOrSmokeOnly?: boolean;
  },
): Promise<{ id: string }> {
  assertRepositoryContext(context);
  if (!input.jobId || !input.reportHash || !input.evidenceManifestId || !input.auditExportId || !input.replayProofId) {
    throw new Error('DSG_COMPLETION_REQUIRED');
  }

  const id = await callDsgRpc<string>(getDsgSupabaseRpcConfig(context.userAccessToken), 'dsg_create_completion_report', {
    p_job_id: input.jobId,
    p_report_hash: input.reportHash,
    p_evidence_manifest_id: input.evidenceManifestId,
    p_audit_export_id: input.auditExportId,
    p_replay_proof_id: input.replayProofId,
    p_deployment_proof_id: input.deploymentProofId ?? null,
    p_production_flow_proof_id: input.productionFlowProofId ?? null,
    p_uses_mock_state: input.usesMockState ?? false,
    p_is_dev_or_smoke_only: input.isDevOrSmokeOnly ?? true,
  });

  return { id };
}
