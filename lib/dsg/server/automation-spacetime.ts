import { spawn } from 'node:child_process';
import { sha256Json } from '@/lib/dsg/runtime/hash';
import { callDsgRpc, getDsgSupabaseRpcConfig, readDsgRest } from './supabase-rpc';
import type { DsgRepositoryContext } from './repository';

const ENGINE_VERSION = '1.18.0';
const DEFAULT_PYTHON = '/opt/dsg-automation/bin/python';
const DEFAULT_ENGINE = '/app/automation_spacetime/engine.py';
const MAX_ENGINE_OUTPUT_BYTES = 1_000_000;

export type AutomationRunRecord = {
  id: string;
  jobId: string;
  workspaceId: string;
  taskPlanId: string;
  wavePlanId: string;
  planHash: string;
  waveHash: string;
  planGraphHash: string;
  engine: string;
  engineVersion: string;
  workflowName: string;
  status: string;
  currentCheckpointId: string | null;
  currentIteration: number;
  createdAt: string;
  updatedAt: string;
};

type AutomationRunRow = {
  id: string;
  job_id: string;
  workspace_id: string;
  task_plan_id: string;
  wave_plan_id: string;
  plan_hash: string;
  wave_hash: string;
  plan_graph_hash: string;
  engine: string;
  engine_version: string;
  workflow_name: string;
  status: string;
  current_checkpoint_id: string | null;
  current_iteration: number;
  created_at: string;
  updated_at: string;
};

type TaskPlanRow = {
  id: string;
  plan_hash: string;
  tasks: Array<{ id: string; dependsOn?: string[]; depends_on?: string[] }>;
  dependency_edges: unknown[];
  created_at: string;
};

type WavePlanRow = {
  id: string;
  wave_hash: string;
  waves: unknown[];
  created_at: string;
};

function mapRun(row: AutomationRunRow): AutomationRunRecord {
  return {
    id: row.id,
    jobId: row.job_id,
    workspaceId: row.workspace_id,
    taskPlanId: row.task_plan_id,
    wavePlanId: row.wave_plan_id,
    planHash: row.plan_hash,
    waveHash: row.wave_hash,
    planGraphHash: row.plan_graph_hash,
    engine: row.engine,
    engineVersion: row.engine_version,
    workflowName: row.workflow_name,
    status: row.status,
    currentCheckpointId: row.current_checkpoint_id,
    currentIteration: row.current_iteration,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getLatestAutomationRun(
  context: DsgRepositoryContext,
  jobId: string,
): Promise<AutomationRunRecord | null> {
  const rows = await readDsgRest<AutomationRunRow[]>(getDsgSupabaseRpcConfig(context.userAccessToken), 'dsg_automation_runs', {
    job_id: `eq.${jobId}`,
    workspace_id: `eq.${context.workspaceId}`,
    select: 'id,job_id,workspace_id,task_plan_id,wave_plan_id,plan_hash,wave_hash,plan_graph_hash,engine,engine_version,workflow_name,status,current_checkpoint_id,current_iteration,created_at,updated_at',
    order: 'created_at.desc',
    limit: '1',
  });
  return rows[0] ? mapRun(rows[0]) : null;
}

export async function getAutomationPlan(
  context: DsgRepositoryContext,
  jobId: string,
  binding?: { taskPlanId: string; wavePlanId: string; planHash: string; waveHash: string },
) {
  const config = getDsgSupabaseRpcConfig(context.userAccessToken);
  const planQuery: Record<string, string> = {
    job_id: `eq.${jobId}`,
    workspace_id: `eq.${context.workspaceId}`,
    select: 'id,plan_hash,tasks,dependency_edges,created_at',
    limit: '1',
  };
  if (binding) planQuery.id = `eq.${binding.taskPlanId}`;
  else planQuery.order = 'created_at.desc';
  const plans = await readDsgRest<TaskPlanRow[]>(config, 'dsg_task_plans', planQuery);
  const taskPlan = plans[0];
  if (!taskPlan) throw new Error(binding ? 'AUTOMATION_BOUND_TASK_PLAN_MISSING' : 'AUTOMATION_TASK_PLAN_REQUIRED');
  if (binding && taskPlan.plan_hash !== binding.planHash) throw new Error('AUTOMATION_BOUND_PLAN_HASH_MISMATCH');

  const waveQuery: Record<string, string> = {
    task_plan_id: `eq.${taskPlan.id}`,
    workspace_id: `eq.${context.workspaceId}`,
    select: 'id,wave_hash,waves,created_at',
    limit: '1',
  };
  if (binding) waveQuery.id = `eq.${binding.wavePlanId}`;
  else waveQuery.order = 'created_at.desc';
  const waves = await readDsgRest<WavePlanRow[]>(config, 'dsg_wave_plans', waveQuery);
  const wavePlan = waves[0];
  if (!wavePlan) throw new Error(binding ? 'AUTOMATION_BOUND_WAVE_PLAN_MISSING' : 'AUTOMATION_WAVE_PLAN_REQUIRED');
  if (binding && wavePlan.wave_hash !== binding.waveHash) throw new Error('AUTOMATION_BOUND_WAVE_HASH_MISMATCH');
  return { taskPlan, wavePlan };
}

export async function startAutomationRun(
  context: DsgRepositoryContext,
  input: { jobId: string; maxRetries?: number },
): Promise<{ runId: string; taskPlan: TaskPlanRow; wavePlan: WavePlanRow; planGraphHash: string }> {
  const { taskPlan, wavePlan } = await getAutomationPlan(context, input.jobId);
  const planGraphHash = sha256Json({
    taskPlanId: taskPlan.id,
    planHash: taskPlan.plan_hash,
    dependencyEdges: taskPlan.dependency_edges,
    wavePlanId: wavePlan.id,
    waveHash: wavePlan.wave_hash,
    waves: wavePlan.waves,
  }).replace(/^sha256:/, '');
  const runId = await callDsgRpc<string>(getDsgSupabaseRpcConfig(context.userAccessToken), 'dsg_start_automation_run', {
    p_job_id: input.jobId,
    p_task_plan_id: taskPlan.id,
    p_wave_plan_id: wavePlan.id,
    p_workflow_name: `core-spin:${input.jobId}`,
    p_plan_graph_hash: planGraphHash,
    p_engine_version: ENGINE_VERSION,
    p_max_retries: input.maxRetries ?? 3,
  });
  return { runId, taskPlan, wavePlan, planGraphHash };
}

export type AutomationEngineResponse = Record<string, unknown> & { ok?: boolean; status?: string };

export async function invokeAutomationEngine(
  payload: Record<string, unknown>,
  timeoutMs = 30_000,
): Promise<AutomationEngineResponse> {
  const python = process.env.DSG_AUTOMATION_PYTHON?.trim() || DEFAULT_PYTHON;
  const engine = process.env.DSG_AUTOMATION_ENGINE?.trim() || DEFAULT_ENGINE;
  return new Promise((resolve, reject) => {
    const child = spawn(python, [engine], { stdio: ['pipe', 'pipe', 'pipe'], shell: false, env: process.env });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let outputBytes = 0;
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('AUTOMATION_ENGINE_TIMEOUT'));
    }, timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_ENGINE_OUTPUT_BYTES) {
        child.kill('SIGKILL');
        reject(new Error('AUTOMATION_ENGINE_OUTPUT_TOO_LARGE'));
        return;
      }
      stdout.push(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(new Error(`AUTOMATION_ENGINE_START_FAILED:${error.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const text = Buffer.concat(stdout).toString('utf8');
      let parsed: AutomationEngineResponse;
      try {
        parsed = JSON.parse(text) as AutomationEngineResponse;
      } catch {
        reject(new Error(`AUTOMATION_ENGINE_RESPONSE_INVALID:${Buffer.concat(stderr).toString('utf8').slice(0, 300)}`));
        return;
      }
      if (code !== 0 || parsed.ok === false) {
        reject(new Error(`AUTOMATION_ENGINE_FAILED:${String(parsed.code ?? code ?? 'unknown')}`));
        return;
      }
      resolve(parsed);
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

export async function probeAutomationEngine(): Promise<AutomationEngineResponse> {
  return invokeAutomationEngine({ operation: 'probe' }, 10_000);
}

export type AutomationStepRecord = {
  taskId: string;
  dependencies: string[];
  status: string;
  attempt: number;
  assignedAgent: string | null;
  nextRunAt: string | null;
  resultRef: string | null;
};

type AutomationStepRow = {
  task_id: string;
  dependencies: string[];
  status: string;
  attempt: number;
  assigned_agent: string | null;
  next_run_at: string | null;
  result_ref: string | null;
};

export async function getAutomationSteps(
  context: DsgRepositoryContext,
  runId: string,
): Promise<AutomationStepRecord[]> {
  const rows = await readDsgRest<AutomationStepRow[]>(getDsgSupabaseRpcConfig(context.userAccessToken), 'dsg_automation_steps', {
    run_id: `eq.${runId}`,
    workspace_id: `eq.${context.workspaceId}`,
    select: 'task_id,dependencies,status,attempt,assigned_agent,next_run_at,result_ref',
    order: 'task_id.asc',
  });
  return rows.map((row) => ({
    taskId: row.task_id,
    dependencies: Array.isArray(row.dependencies) ? row.dependencies.map(String) : [],
    status: row.status,
    attempt: row.attempt,
    assignedAgent: row.assigned_agent,
    nextRunAt: row.next_run_at,
    resultRef: row.result_ref,
  }));
}

export async function evaluateAutomationRun(
  context: DsgRepositoryContext,
  run: AutomationRunRecord,
): Promise<AutomationEngineResponse> {
  const { taskPlan, wavePlan } = await getAutomationPlan(context, run.jobId, {
    taskPlanId: run.taskPlanId,
    wavePlanId: run.wavePlanId,
    planHash: run.planHash,
    waveHash: run.waveHash,
  });
  const currentPlanGraphHash = sha256Json({
    taskPlanId: taskPlan.id,
    planHash: taskPlan.plan_hash,
    dependencyEdges: taskPlan.dependency_edges,
    wavePlanId: wavePlan.id,
    waveHash: wavePlan.wave_hash,
    waves: wavePlan.waves,
  }).replace(/^sha256:/, '');
  if (currentPlanGraphHash !== run.planGraphHash) throw new Error('AUTOMATION_BOUND_PLAN_GRAPH_MISMATCH');
  const steps = await getAutomationSteps(context, run.id);
  const byId = new Map(steps.map((step) => [step.taskId, step] as const));
  const tasks = taskPlan.tasks.map((task) => ({
    id: task.id,
    dependsOn: task.dependsOn ?? task.depends_on ?? [],
    status: byId.get(task.id)?.status ?? 'PENDING',
    attempt: byId.get(task.id)?.attempt ?? 0,
    assignedAgent: byId.get(task.id)?.assignedAgent ?? null,
  }));
  return invokeAutomationEngine({
    operation: 'evaluate',
    run_id: run.id,
    job_id: run.jobId,
    workflow_name: run.workflowName,
    tasks,
    completed_step_ids: steps.filter((step) => step.status === 'COMPLETED').map((step) => step.taskId),
    blocked_step_ids: steps.filter((step) => ['BLOCKED', 'FAILED', 'KILLED'].includes(step.status)).map((step) => step.taskId),
    waves: wavePlan.waves,
  });
}

export async function transitionAutomationStep(
  context: DsgRepositoryContext,
  input: {
    runId: string;
    taskId: string;
    expectedStatus: string;
    nextStatus: string;
    assignedAgent?: string | null;
    resultRef?: string | null;
    nextRunAt?: string | null;
  },
): Promise<{ task_id: string; status: string; attempt: number }> {
  return callDsgRpc(getDsgSupabaseRpcConfig(context.userAccessToken), 'dsg_automation_transition_step', {
    p_run_id: input.runId,
    p_task_id: input.taskId,
    p_expected_status: input.expectedStatus,
    p_next_status: input.nextStatus,
    p_assigned_agent: input.assignedAgent ?? null,
    p_result_ref: input.resultRef ?? null,
    p_next_run_at: input.nextRunAt ?? null,
  });
}

export async function acquireAutomationLease(
  context: DsgRepositoryContext,
  input: { runId: string; stepKey: string; ownerId: string; ttlSeconds?: number },
): Promise<string> {
  return callDsgRpc<string>(getDsgSupabaseRpcConfig(context.userAccessToken), 'dsg_automation_acquire_lease', {
    p_run_id: input.runId,
    p_step_key: input.stepKey,
    p_owner_id: input.ownerId,
    p_ttl_seconds: input.ttlSeconds ?? 60,
  });
}
