import crypto from 'node:crypto';
import type { AppBuilderJob } from './model';
import { createAppBuilderRuntimeHandoff, type AppBuilderRuntimeHandoff } from './runtime-handoff';
import { supabaseRest } from '@/lib/dsg/server/app-builder/supabase-rest';

export type AppBuilderRuntimeGateStatus = 'READY' | 'BLOCKED';
export type AppBuilderRuntimeGateSeverity = 'HARD' | 'SOFT';

export type AppBuilderRuntimeGateFailure = {
  invariant: string;
  severity: AppBuilderRuntimeGateSeverity;
  expected: string;
  actual: string;
  message: string;
};

export type AppBuilderRuntimeGateSnapshot = {
  appBuilderJobId: string;
  workspaceId: string;
  planHash: string;
  approvalHash: string;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  approvalSignatureValid: boolean;
  approvalApprovedBy: string | null;
  approvalApprovedAt: string | null;
  requiredSecrets: string[];
  presentSecrets: string[];
  missingSecrets: string[];
  allowedTools: string[];
  allowedPaths: string[];
  allowedCommands: string[];
  handoffHash: string;
  handoffValid: boolean;
  executorEnvReady: boolean;
  executorGithubReady: boolean;
  executorBranchReady: boolean;
  proofRequiredRefs: string[];
  proofPresentRefs: string[];
  proofComplete: boolean;
};

export type AppBuilderRuntimeGateDecision = {
  status: AppBuilderRuntimeGateStatus;
  canStartRuntime: boolean;
  gateHash: string;
  failures: AppBuilderRuntimeGateFailure[];
  evaluatedAt: string;
  snapshot: AppBuilderRuntimeGateSnapshot;
};

type SnapshotRow = Record<string, unknown>;

const REQUIRED_EXECUTOR_ENV = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'GITHUB_TOKEN',
  'DSG_BUILDER_GITHUB_OWNER',
  'DSG_BUILDER_GITHUB_REPO',
  'DSG_BUILDER_BASE_BRANCH',
];

const REQUIRED_PROOF_REFS = ['planHash', 'approvalHash', 'handoffHash'];

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
}

function sha256(value: unknown): string {
  return crypto.createHash('sha256').update(stableJson(value)).digest('hex');
}

function envPresent(key: string): boolean {
  return typeof process.env[key] === 'string' && process.env[key]!.trim().length > 0;
}

function pushFailure(failures: AppBuilderRuntimeGateFailure[], failure: AppBuilderRuntimeGateFailure) {
  failures.push(failure);
}

export function createRuntimeGateSnapshotFromJob(job: AppBuilderJob): AppBuilderRuntimeGateSnapshot {
  const handoff: AppBuilderRuntimeHandoff = createAppBuilderRuntimeHandoff(job);
  const requiredSecrets = Array.from(new Set([...handoff.requiredSecrets, ...REQUIRED_EXECUTOR_ENV]));
  const presentSecrets = requiredSecrets.filter(envPresent);
  const missingSecrets = requiredSecrets.filter((key) => !envPresent(key));
  const handoffHash = sha256(handoff);
  const proofPresentRefs = [handoff.planHash ? 'planHash' : '', handoff.approvalHash ? 'approvalHash' : '', handoffHash ? 'handoffHash' : ''].filter(Boolean);

  return {
    appBuilderJobId: job.id,
    workspaceId: job.workspaceId,
    planHash: handoff.planHash,
    approvalHash: handoff.approvalHash,
    approvalStatus: job.status === 'READY_FOR_RUNTIME' ? 'APPROVED' : 'PENDING',
    approvalSignatureValid: Boolean(job.approvedPlan?.approvalHash && job.approvalHash === job.approvedPlan.approvalHash),
    approvalApprovedBy: job.approvedPlan?.approvedBy ?? null,
    approvalApprovedAt: job.approvedPlan?.approvedAt ?? null,
    requiredSecrets,
    presentSecrets,
    missingSecrets,
    allowedTools: handoff.allowedTools,
    allowedPaths: handoff.allowedPaths,
    allowedCommands: handoff.allowedCommands,
    handoffHash,
    handoffValid: handoff.runtimeStatus === 'READY_FOR_RUNTIME' && handoff.planHash === job.planHash && handoff.approvalHash === job.approvalHash,
    executorEnvReady: missingSecrets.length === 0,
    executorGithubReady: ['GITHUB_TOKEN', 'DSG_BUILDER_GITHUB_OWNER', 'DSG_BUILDER_GITHUB_REPO'].every(envPresent),
    executorBranchReady: envPresent('DSG_BUILDER_BASE_BRANCH'),
    proofRequiredRefs: REQUIRED_PROOF_REFS,
    proofPresentRefs,
    proofComplete: REQUIRED_PROOF_REFS.every((ref) => proofPresentRefs.includes(ref)),
  };
}

export function evaluateRuntimeGateSnapshot(snapshot: AppBuilderRuntimeGateSnapshot): AppBuilderRuntimeGateDecision {
  const failures: AppBuilderRuntimeGateFailure[] = [];

  if (snapshot.approvalStatus !== 'APPROVED') {
    pushFailure(failures, {
      invariant: 'approval_status',
      severity: 'HARD',
      expected: 'APPROVED',
      actual: snapshot.approvalStatus,
      message: 'Runtime cannot start before approved DB-backed job state.',
    });
  }

  if (!snapshot.approvalSignatureValid) {
    pushFailure(failures, {
      invariant: 'approval_signature_valid',
      severity: 'HARD',
      expected: 'true',
      actual: String(snapshot.approvalSignatureValid),
      message: 'Approval hash must match the approved plan hash record.',
    });
  }

  if (!snapshot.handoffValid) {
    pushFailure(failures, {
      invariant: 'handoff_valid',
      severity: 'HARD',
      expected: 'true',
      actual: String(snapshot.handoffValid),
      message: 'Runtime handoff must match the job planHash and approvalHash.',
    });
  }

  if (!snapshot.executorEnvReady) {
    pushFailure(failures, {
      invariant: 'executor_env_ready',
      severity: 'HARD',
      expected: 'all required runtime secrets present',
      actual: `missing:${snapshot.missingSecrets.join(',') || 'none'}`,
      message: 'Required runtime secrets are missing. Runtime must fail closed.',
    });
  }

  if (!snapshot.executorGithubReady) {
    pushFailure(failures, {
      invariant: 'executor_github_ready',
      severity: 'HARD',
      expected: 'GitHub runtime env configured',
      actual: 'missing GitHub owner/repo/token env',
      message: 'GitHub runtime executor is not ready.',
    });
  }

  if (!snapshot.executorBranchReady) {
    pushFailure(failures, {
      invariant: 'executor_branch_ready',
      severity: 'HARD',
      expected: 'base branch configured',
      actual: 'missing DSG_BUILDER_BASE_BRANCH',
      message: 'Runtime base branch is not configured.',
    });
  }

  if (!snapshot.proofComplete) {
    pushFailure(failures, {
      invariant: 'proof_complete',
      severity: 'HARD',
      expected: snapshot.proofRequiredRefs.join(','),
      actual: snapshot.proofPresentRefs.join(',') || 'none',
      message: 'Runtime gate proof refs are incomplete.',
    });
  }

  if (snapshot.allowedTools.length === 0) {
    pushFailure(failures, {
      invariant: 'allowed_tools',
      severity: 'HARD',
      expected: 'one or more approved tools',
      actual: 'none',
      message: 'Approved plan has no allowed runtime tools.',
    });
  }

  const status: AppBuilderRuntimeGateStatus = failures.some((failure) => failure.severity === 'HARD') ? 'BLOCKED' : 'READY';
  const evaluatedAt = new Date().toISOString();
  const gateHash = sha256({ status, failures, snapshot });

  return {
    status,
    canStartRuntime: status === 'READY',
    gateHash,
    failures,
    evaluatedAt,
    snapshot,
  };
}

function rowFromSnapshot(input: AppBuilderRuntimeGateDecision): SnapshotRow {
  const snapshot = input.snapshot;
  return {
    app_builder_job_id: snapshot.appBuilderJobId,
    workspace_id: snapshot.workspaceId,
    plan_hash: snapshot.planHash,
    approval_hash: snapshot.approvalHash,
    approval_status: snapshot.approvalStatus,
    approval_signature_valid: snapshot.approvalSignatureValid,
    approval_approved_by: snapshot.approvalApprovedBy,
    approval_approved_at: snapshot.approvalApprovedAt,
    required_secrets: snapshot.requiredSecrets,
    present_secrets: snapshot.presentSecrets,
    missing_secrets: snapshot.missingSecrets,
    allowed_tools: snapshot.allowedTools,
    allowed_paths: snapshot.allowedPaths,
    allowed_commands: snapshot.allowedCommands,
    handoff_hash: snapshot.handoffHash,
    handoff_valid: snapshot.handoffValid,
    executor_env_ready: snapshot.executorEnvReady,
    executor_github_ready: snapshot.executorGithubReady,
    executor_branch_ready: snapshot.executorBranchReady,
    proof_required_refs: snapshot.proofRequiredRefs,
    proof_present_refs: snapshot.proofPresentRefs,
    proof_complete: snapshot.proofComplete,
    last_gate_status: input.status,
    last_gate_hash: input.gateHash,
    last_failure_reasons: input.failures,
    last_evaluated_at: input.evaluatedAt,
  };
}

export async function recordRuntimeGateSnapshot(decision: AppBuilderRuntimeGateDecision): Promise<void> {
  const row = rowFromSnapshot(decision);
  const updatedRows = await supabaseRest<SnapshotRow[]>({
    method: 'PATCH',
    path: 'dsg_app_builder_runtime_gate_snapshots',
    query: `?app_builder_job_id=eq.${decision.snapshot.appBuilderJobId}&select=id`,
    body: row,
  });

  if (updatedRows.length > 0) return;

  await supabaseRest<SnapshotRow[]>({
    method: 'POST',
    path: 'dsg_app_builder_runtime_gate_snapshots',
    body: row,
  });
}

export async function evaluateAndRecordRuntimeGateFromJob(job: AppBuilderJob): Promise<AppBuilderRuntimeGateDecision> {
  const snapshot = createRuntimeGateSnapshotFromJob(job);
  const decision = evaluateRuntimeGateSnapshot(snapshot);
  await recordRuntimeGateSnapshot(decision);
  return decision;
}

export async function assertRuntimeGateReady(job: AppBuilderJob): Promise<AppBuilderRuntimeGateDecision> {
  const decision = await evaluateAndRecordRuntimeGateFromJob(job);
  if (!decision.canStartRuntime) {
    const reasons = decision.failures.map((failure) => `${failure.invariant}:${failure.actual}`).join('; ');
    throw new Error(`APP_BUILDER_RUNTIME_GATE_BLOCKED:${reasons}`);
  }
  return decision;
}

export function safeGateFailure(error: unknown, jobId: string): AppBuilderRuntimeGateDecision {
  const snapshot: AppBuilderRuntimeGateSnapshot = {
    appBuilderJobId: jobId,
    workspaceId: 'unknown',
    planHash: '',
    approvalHash: '',
    approvalStatus: 'PENDING',
    approvalSignatureValid: false,
    approvalApprovedBy: null,
    approvalApprovedAt: null,
    requiredSecrets: REQUIRED_EXECUTOR_ENV,
    presentSecrets: REQUIRED_EXECUTOR_ENV.filter(envPresent),
    missingSecrets: REQUIRED_EXECUTOR_ENV.filter((key) => !envPresent(key)),
    allowedTools: [],
    allowedPaths: [],
    allowedCommands: [],
    handoffHash: '',
    handoffValid: false,
    executorEnvReady: false,
    executorGithubReady: false,
    executorBranchReady: false,
    proofRequiredRefs: REQUIRED_PROOF_REFS,
    proofPresentRefs: [],
    proofComplete: false,
  };
  const message = error instanceof Error ? error.message : 'APP_BUILDER_RUNTIME_GATE_FAILED';
  return {
    status: 'BLOCKED',
    canStartRuntime: false,
    gateHash: sha256({ message, snapshot }),
    failures: [{
      invariant: 'gate_evaluation',
      severity: 'HARD',
      expected: 'successful DB-backed runtime gate evaluation',
      actual: message,
      message,
    }],
    evaluatedAt: new Date().toISOString(),
    snapshot,
  };
}
