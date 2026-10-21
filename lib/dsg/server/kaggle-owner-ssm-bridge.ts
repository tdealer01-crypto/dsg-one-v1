import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execute = promisify(execFile);
export type OwnerKaggleBridge = {
  ok: boolean;
  connected?: boolean;
  dispatchConfigured?: boolean;
  source?: string;
  gpuState: 'UNVERIFIED';
  status?: string;
  message?: string;
  workflows?: Array<{ name: 'OWNER_LAUNCH' | 'GOVERNED_E2E' | 'STOP_PROOF'; state: string; runId: number; updatedAt: string }>;
  error?: string;
};

export async function callKaggleOwnerBridge(mode: 'status' | 'launch'): Promise<OwnerKaggleBridge> {
  // No browser token, Github PAT, dynamic command, shell expansion or user
  // arguments. Python uses the existing EC2 IAM role to read exactly one
  // SecureString. It returns strictly bounded, token-free JSON.
  let stdout = '';
  try {
    const out = await execute(
      '/opt/dsg-automation/bin/python',
      ['/app/scripts/dsg_kaggle_owner_ssm_bridge.py', mode === 'status' ? '--status' : '--launch'],
      { timeout: 18_000, maxBuffer: 4096, windowsHide: true },
    );
    stdout = out.stdout;
  } catch (err) {
    // execFile errors may carry stdout with one safe structured failure but
    // also stderr/process fields: never stringify or log the exception.
    const safe = err && typeof err === 'object' && 'stdout' in err
      ? (err as { stdout?: unknown }).stdout : '';
    stdout = typeof safe === 'string' && safe.length <= 4096 ? safe : '';
  }
  try {
    const parsed: unknown = JSON.parse(stdout);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('INVALID');
    const payload = parsed as Record<string, unknown>;
    if (typeof payload.ok !== 'boolean' || payload.gpuState !== 'UNVERIFIED') throw Error('INVALID');
    const knownError = new Set([
      'KAGGLE_OWNER_DISPATCH_NOT_CONFIGURED',
      'KAGGLE_SSM_CREDENTIAL_READ_DENIED',
      'KAGGLE_OWNER_CREDENTIAL_INVALID',
      'KAGGLE_GITHUB_OWNER_IDENTITY_MISMATCH',
      'KAGGLE_GITHUB_REQUEST_UNAVAILABLE',
      'KAGGLE_GITHUB_READ_FAILED',
      'KAGGLE_GITHUB_RESPONSE_TOO_LARGE',
      'KAGGLE_RUNS_RESPONSE_INVALID',
      'KAGGLE_OWNER_DISPATCH_LOCKED',
      'KAGGLE_GPU_JOB_ALREADY_IN_PROGRESS',
      'KAGGLE_RUN_DATE_UNVERIFIED',
      'KAGGLE_RUN_CLOCK_INVALID',
      'KAGGLE_RECENT_LAUNCH_COOLDOWN',
      'KAGGLE_WORKFLOW_DISPATCH_NOT_ACCEPTED',
      'KAGGLE_OWNER_BRIDGE_UNAVAILABLE',
    ]);
    if (payload.ok === false) return {
      ok: false, error: knownError.has(String(payload.error)) ? String(payload.error) : 'KAGGLE_OWNER_BRIDGE_UNAVAILABLE',
      gpuState: 'UNVERIFIED',
    };
    if (mode === 'launch') {
      if (payload.status !== 'OWNER_DISPATCH_ACCEPTED') throw Error('INVALID');
      return { ok: true, status: 'OWNER_DISPATCH_ACCEPTED', gpuState: 'UNVERIFIED' };
    }
    if (typeof payload.connected !== 'boolean' || typeof payload.dispatchConfigured !== 'boolean') throw Error('INVALID');
    const workflows: NonNullable<OwnerKaggleBridge['workflows']> = [];
    if (payload.connected) {
      if (!Array.isArray(payload.workflows) || payload.workflows.length > 3) throw Error('INVALID');
      const knownNames = new Set(['OWNER_LAUNCH', 'GOVERNED_E2E', 'STOP_PROOF']);
      const states = new Set(['QUEUED', 'IN_PROGRESS', 'SUCCESS', 'FAILED', 'UNKNOWN']);
      for (const raw of payload.workflows) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('INVALID');
        const row = raw as Record<string, unknown>;
        if (!knownNames.has(String(row.name)) || !states.has(String(row.state)) ||
            !Number.isSafeInteger(row.runId) || typeof row.updatedAt !== 'string' ||
            !/^\d{4}-\d{2}-\d{2}T[^\s]{9,40}$/.test(row.updatedAt)) throw Error('INVALID');
        workflows.push({
          name: row.name as NonNullable<OwnerKaggleBridge['workflows']>[number]['name'],
          state: String(row.state), runId: Number(row.runId), updatedAt: row.updatedAt,
        });
      }
    }
    return {
      ok: true, connected: payload.connected, dispatchConfigured: payload.dispatchConfigured,
      gpuState: 'UNVERIFIED', workflows,
      source: payload.connected ? 'AWS_SSM_GITHUB_ACTIONS_READ_ONLY' : 'NOT_CONFIGURED',
      ...(!payload.connected ? { message: 'KAGGLE_OWNER_DISPATCH_NOT_CONFIGURED' } : {}),
    };
  } catch {
    return { ok: false, error: 'KAGGLE_OWNER_BRIDGE_UNAVAILABLE', gpuState: 'UNVERIFIED' };
  }
}
