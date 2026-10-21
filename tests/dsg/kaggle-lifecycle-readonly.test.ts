import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requireVerifiedDsgActor } from '@/lib/dsg/server/context';
import { GET, POST } from '@/app/api/dsg/agent-v0/lifecycle/route';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('@/lib/dsg/server/context', () => ({
  requireVerifiedDsgActor: vi.fn(),
}));

const actor = vi.mocked(requireVerifiedDsgActor);
const path = (name: string) => readFileSync(join(process.cwd(), name), 'utf8');
const req = () => new Request('https://dsg.pics/api/dsg/agent-v0/lifecycle');

describe('owner Agent v0 Kaggle GPU status (read only, never invented READY)', () => {
  const originalToken = process.env.DSG_KAGGLE_WORKFLOW_READ_TOKEN;
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.DSG_KAGGLE_WORKFLOW_READ_TOKEN;
    actor.mockReset();
    actor.mockResolvedValue({ actorId: 'owner', workspaceId: 'workspace', role: 'OWNER' });
  });
  afterEach(() => {
    if (originalToken === undefined) delete process.env.DSG_KAGGLE_WORKFLOW_READ_TOKEN;
    else process.env.DSG_KAGGLE_WORKFLOW_READ_TOKEN = originalToken;
    vi.unstubAllGlobals();
  });

  it('fails closed without a verified owner role', async () => {
    actor.mockRejectedValueOnce(new Error('DSG_AUTH_REQUIRED'));
    const unauth = await GET(req());
    expect(unauth.status).toBe(401);
    actor.mockResolvedValueOnce({ actorId: 'viewer', workspaceId: 'workspace', role: 'VIEWER' });
    const viewer = await GET(req());
    expect(viewer.status).toBe(403);
    expect((await viewer.json()).error).toBe('KAGGLE_OWNER_REQUIRED');
  });

  it('does not claim GPU running when private workflow reader is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const reply = await GET(req());
    const payload = await reply.json();
    expect(reply.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true, connected: false, gpuState: 'UNVERIFIED',
      message: 'KAGGLE_WORKFLOW_READ_CREDENTIAL_NOT_CONFIGURED',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reads only fixed owner workflows and never confuses Actions success with GPU health', async () => {
    process.env.DSG_KAGGLE_WORKFLOW_READ_TOKEN = 'dummy-test-read-token';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ workflow_runs: [{ id: 101, status: 'completed', conclusion: 'success', updated_at: '2026-10-21T09:00:00Z' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ workflow_runs: [{ id: 102, status: 'in_progress', conclusion: null, updated_at: '2026-10-21T09:10:00Z' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ workflow_runs: [{ id: 103, status: 'completed', conclusion: 'failure', updated_at: '2026-10-21T09:11:00Z' }] }) });
    vi.stubGlobal('fetch', fetchMock);
    const reply = await GET(req());
    const payload = await reply.json();
    expect(reply.status).toBe(200);
    expect(payload).toMatchObject({ ok: true, connected: true, source: 'GITHUB_ACTIONS_READ_ONLY', gpuState: 'UNVERIFIED' });
    expect(payload.workflows).toEqual([
      { name: 'OWNER_LAUNCH', state: 'SUCCESS', runId: 101, updatedAt: '2026-10-21T09:00:00Z' },
      { name: 'GOVERNED_E2E', state: 'IN_PROGRESS', runId: 102, updatedAt: '2026-10-21T09:10:00Z' },
      { name: 'STOP_PROOF', state: 'FAILED', runId: 103, updatedAt: '2026-10-21T09:11:00Z' },
    ]);
    for (const [url, init] of fetchMock.mock.calls) {
      expect(url).toContain('https://api.github.com/repos/tdealer01-crypto/DSG-Private-Production-Runtime/actions/workflows/');
      expect(init.headers.Authorization).toBe('Bearer dummy-test-read-token');
      expect(init.cache).toBe('no-store');
    }
    expect(JSON.stringify(payload)).not.toContain('dummy-test-read-token');
  });

  it('rejects upstream errors and does not dispatch an owner GPU from a status API', async () => {
    process.env.DSG_KAGGLE_WORKFLOW_READ_TOKEN = 'dummy-test-read-token';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    const reply = await GET(req());
    expect(reply.status).toBe(503);
    expect((await reply.json()).gpuState).toBe('UNVERIFIED');
    const launch = await POST();
    expect(launch.status).toBe(405);
    expect((await launch.json()).error).toBe('KAGGLE_OWNER_SIGNED_DISPATCH_NOT_CONNECTED');
  });

  it('reuses the real Workroom Qwen route; no false START button or browser credentials', () => {
    const live = path('components/dsg-live-workroom.tsx');
    const status = path('components/dsg-kaggle-gpu-status.tsx');
    const api = path('app/api/dsg/agent-v0/lifecycle/route.ts');
    expect(live).toContain('<DsgKaggleGpuStatus />');
    expect(live).toContain("run('action.plan', 'node.agent.dsg-v0'");
    expect(status).toContain("credentials: 'include'");
    expect(status).toContain('Workroom ไม่ได้เปิด GPU อัตโนมัติ');
    expect(api).toContain("requireVerifiedDsgActor(request.headers, 'job:read')");
    expect(api).not.toContain('kernels push');
    expect(api).not.toContain('workflow_dispatch');
    expect(status).not.toContain('localStorage');
  });
});
