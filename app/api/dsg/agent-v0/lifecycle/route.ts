import { NextResponse } from 'next/server';
import { requireVerifiedDsgActor } from '@/lib/dsg/server/context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GitHub Actions is controller telemetry, NOT the actual Kaggle kernel state.
// A successful workflow must never be labelled GPU READY or STOPPED.
const REPO = 'tdealer01-crypto/DSG-Private-Production-Runtime';
const WORKFLOWS = [
  { id: 'launch-kaggle-brain-oidc.yml', name: 'OWNER_LAUNCH' },
  { id: 'kaggle-brain-one-shot-e2e.yml', name: 'GOVERNED_E2E' },
  { id: 'kaggle-worker-shutdown-readonly.yml', name: 'STOP_PROOF' },
] as const;

type SafeState = 'QUEUED' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILED' | 'UNKNOWN';
type WorkflowName = (typeof WORKFLOWS)[number]['name'];
type WorkflowSnapshot = { name: WorkflowName; state: SafeState; runId: number; updatedAt: string };

function safeState(status: unknown, conclusion: unknown): SafeState {
  if (status === 'queued' || status === 'waiting' || status === 'pending' || status === 'requested') return 'QUEUED';
  if (status === 'in_progress') return 'IN_PROGRESS';
  if (status === 'completed' && conclusion === 'success') return 'SUCCESS';
  if (status === 'completed') return 'FAILED';
  return 'UNKNOWN';
}

async function readWorkflow(
  token: string, workflow: (typeof WORKFLOWS)[number],
): Promise<WorkflowSnapshot | null> {
  const url = 'https://api.github.com/repos/' + REPO +
    '/actions/workflows/' + workflow.id + '/runs?event=workflow_dispatch&per_page=1';
  const response = await fetch(url, {
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error('KAGGLE_WORKFLOW_READ_UNAVAILABLE');
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object' || !('workflow_runs' in payload) ||
    !Array.isArray(payload.workflow_runs)) throw new Error('KAGGLE_WORKFLOW_RESPONSE_INVALID');
  const run: unknown = payload.workflow_runs[0];
  if (!run || typeof run !== 'object') return null;
  const row = run as Record<string, unknown>;
  if (typeof row.id !== 'number' || !Number.isSafeInteger(row.id) ||
      typeof row.updated_at !== 'string') throw new Error('KAGGLE_WORKFLOW_RESPONSE_INVALID');
  return {
    name: workflow.name,
    runId: row.id,
    updatedAt: row.updated_at,
    state: safeState(row.status, row.conclusion),
  };
}

function json(status: number, data: Record<string, unknown>) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export async function GET(request: Request) {
  try {
    const actor = await requireVerifiedDsgActor(request.headers, 'job:read');
    if (actor.role !== 'OWNER') return json(403, { ok: false, error: 'KAGGLE_OWNER_REQUIRED' });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'DSG_AUTH_FAILED';
    return json(reason === 'DSG_AUTH_REQUIRED' ? 401 : 403, { ok: false, error: reason });
  }

  // No private logs, Kaggle credentials, handoff URLs, quota guesses or
  // inferred live GPU state appear in the HTTP response.
  const dispatchConfigured = Boolean(process.env.DSG_KAGGLE_OWNER_DISPATCH_TOKEN);
  const token = process.env.DSG_KAGGLE_WORKFLOW_READ_TOKEN;
  if (!token) return json(200, {
    ok: true, connected: false, dispatchConfigured, source: 'NOT_CONFIGURED', gpuState: 'UNVERIFIED',
    message: 'KAGGLE_WORKFLOW_READ_CREDENTIAL_NOT_CONFIGURED', workflows: [],
  });
  try {
    const snapshots = await Promise.all(WORKFLOWS.map(item => readWorkflow(token, item)));
    return json(200, {
      ok: true, connected: true, dispatchConfigured, source: 'GITHUB_ACTIONS_READ_ONLY',
      gpuState: 'UNVERIFIED',
      workflows: snapshots.filter((item): item is WorkflowSnapshot => item !== null),
    });
  } catch {
    return json(503, {
      ok: false, error: 'KAGGLE_WORKFLOW_READ_UNAVAILABLE',
      gpuState: 'UNVERIFIED', workflows: [],
    });
  }
}

// Owner-signed delegated start, durable idempotency and Kaggle quota
// verification must be connected before the site may start any new GPU run.
export async function POST() {
  return json(405, { ok: false, error: 'KAGGLE_OWNER_SIGNED_DISPATCH_NOT_CONNECTED' });
}
