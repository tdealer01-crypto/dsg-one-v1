import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requireVerifiedDsgActor } from '@/lib/dsg/server/context';
import { runKaggleSsmBridge } from '@/lib/dsg/server/kaggle-ssm-bridge';
import { GET, POST } from '@/app/api/dsg/agent-v0/lifecycle/route';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('@/lib/dsg/server/context', () => ({ requireVerifiedDsgActor: vi.fn() }));
vi.mock('@/lib/dsg/server/kaggle-ssm-bridge', () => ({ runKaggleSsmBridge: vi.fn() }));

const actor = vi.mocked(requireVerifiedDsgActor);
const probe = vi.mocked(runKaggleSsmBridge);
const path = (name: string) => readFileSync(join(process.cwd(), name), 'utf8');
const req = () => new Request('https://dsg.pics/api/dsg/agent-v0/lifecycle');

describe('owner-only AWS SSM Kaggle status', () => {
  beforeEach(() => {
    actor.mockReset();
    probe.mockReset();
    actor.mockResolvedValue({ actorId: 'owner', workspaceId: 'workspace', role: 'OWNER' });
    probe.mockResolvedValue({
      httpStatus: 200, ok: true, connected: false, dispatchConfigured: false,
      gpuState: 'UNVERIFIED', source: 'AWS_SSM_NOT_CONFIGURED', workflows: [],
    });
  });
  afterEach(() => vi.clearAllMocks());

  it('rejects unverified and nonowner request before reaching secret store', async () => {
    actor.mockRejectedValueOnce(new Error('DSG_AUTH_REQUIRED'));
    expect((await GET(req())).status).toBe(401);
    actor.mockResolvedValueOnce({ actorId: 'viewer', workspaceId: 'workspace', role: 'VIEWER' });
    expect((await GET(req())).status).toBe(403);
    expect(probe).not.toHaveBeenCalled();
  });

  it('reports missing SSM SecureString without pretending the GPU is ready', async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true, connected: false, dispatchConfigured: false,
      source: 'AWS_SSM_NOT_CONFIGURED', gpuState: 'UNVERIFIED',
    });
    expect(probe).toHaveBeenCalledWith('status');
  });

  it('reads workflow metadata without turning GitHub success into GPU READY', async () => {
    probe.mockResolvedValueOnce({
      httpStatus: 200, ok: true, connected: true, dispatchConfigured: true,
      gpuState: 'UNVERIFIED', source: 'AWS_SSM_GITHUB_ACTIONS_READ_ONLY',
      workflows: [{ name: 'OWNER_LAUNCH', state: 'SUCCESS', runId: 123,
        updatedAt: '2026-10-21T09:00:00Z' }],
    });
    const res = await GET(req());
    const obj = await res.json();
    expect(obj.gpuState).toBe('UNVERIFIED');
    expect(obj.workflows[0]).toMatchObject({ name: 'OWNER_LAUNCH', state: 'SUCCESS' });
    expect(JSON.stringify(obj)).not.toMatch(/github_pat_|ghp_|AWS_SECRET_ACCESS_KEY/);
  });

  it('fails closed for any SSM/GitHub bridge error and does not accept POST', async () => {
    probe.mockResolvedValueOnce({ httpStatus: 503, ok: false, error: 'KAGGLE_OWNER_SECURE_BRIDGE_UNAVAILABLE', gpuState: 'UNVERIFIED' });
    const res = await GET(req());
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('KAGGLE_OWNER_SECURE_BRIDGE_UNAVAILABLE');
    const launch = await POST();
    expect(launch.status).toBe(405);
  });

  it('uses owner-only SSM adapter in original Workroom, no localStorage secrets', () => {
    const live = path('components/dsg-live-workroom.tsx');
    const status = path('components/dsg-kaggle-gpu-status.tsx');
    const api = path('app/api/dsg/agent-v0/lifecycle/route.ts');
    const adapter = path('lib/dsg/server/kaggle-ssm-bridge.ts');
    const python = path('scripts/dsg-kaggle-ssm-bridge.py');
    expect(live).toContain('<DsgKaggleGpuStatus />');
    expect(live).toContain("run('action.plan', 'node.agent.dsg-v0'");
    expect(status).toContain("credentials: 'include'");
    expect(api).toContain("requireVerifiedDsgActor(request.headers, 'job:read')");
    expect(api).toContain("runKaggleSsmBridge('status')");
    expect(adapter).toContain("execFileAsync(PYTHON, [BRIDGE, action]");
    expect(python).toContain("WithDecryption=True");
    expect(python).not.toContain("print(token)");
    expect(status).not.toContain('localStorage');
  });
});
