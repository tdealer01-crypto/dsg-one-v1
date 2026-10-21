import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// No client input, shell or arbitrary parameter name is ever accepted here.
// The server's Python boto3 process uses the existing EC2 instance profile and
// calls only fixed SSM SecureString names and fixed GitHub workflow endpoints.
const PYTHON = '/opt/dsg-automation/bin/python';
const BRIDGE = '/app/scripts/dsg-kaggle-ssm-bridge.py';

export type KaggleBridgeResult = {
  httpStatus: number;
  ok: boolean;
  connected?: boolean;
  dispatchConfigured?: boolean;
  gpuState?: 'UNVERIFIED';
  source?: string;
  workflows?: unknown[];
  error?: string;
  status?: string;
  details?: string;
};

export async function runKaggleSsmBridge(action: 'status' | 'start'): Promise<KaggleBridgeResult> {
  try {
    const { stdout } = await execFileAsync(PYTHON, [BRIDGE, action], {
      encoding: 'utf8',
      timeout: 35_000,
      maxBuffer: 24_000,
      windowsHide: true,
      shell: false,
    });
    const response: unknown = JSON.parse(stdout);
    if (!response || typeof response !== 'object' || Array.isArray(response)) throw Error('INVALID_RESPONSE');
    const data = response as Record<string, unknown>;
    if (typeof data.httpStatus !== 'number' || !Number.isInteger(data.httpStatus) ||
        data.httpStatus < 200 || data.httpStatus > 599 ||
        typeof data.ok !== 'boolean') throw Error('INVALID_RESPONSE');
    const safeKeys = new Set([
      'httpStatus', 'ok', 'connected', 'dispatchConfigured', 'gpuState',
      'source', 'workflows', 'error', 'status', 'details',
    ]);
    if (Object.keys(data).some(key => !safeKeys.has(key))) throw Error('UNEXPECTED_BRIDGE_FIELD');
    return data as KaggleBridgeResult;
  } catch {
    // Never echo process errors, stderr, AWS policy paths or credentials.
    return { httpStatus: 503, ok: false, error: 'KAGGLE_OWNER_SECURE_BRIDGE_UNAVAILABLE', gpuState: 'UNVERIFIED' };
  }
}
