import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { requireVerifiedDsgActor } from '@/lib/dsg/server/context';
import { verifyDsgAuth0Principal } from '@/lib/dsg/server/auth0-identity';
import { getDsgSupabaseRpcConfig, readDsgRest } from '@/lib/dsg/server/supabase-rpc';
import { POST } from '@/app/api/dsg/agent-v0/launch/route';

vi.mock('@/lib/dsg/server/context', () => ({ requireVerifiedDsgActor: vi.fn() }));
vi.mock('@/lib/dsg/server/auth0-identity', () => ({
  DSG_AUTH0_ISSUER: 'https://dev-kcddqmnusbxxo25s.us.auth0.com/',
  DSG_AUTH0_CLIENT_ID: 'mLIAcMEAhuVDaUvzXn8Qo54zj2llFp3X',
  verifyDsgAuth0Principal: vi.fn(),
}));
vi.mock('@/lib/dsg/server/supabase-rpc', () => ({
  getDsgSupabaseRpcConfig: vi.fn(),
  readDsgRest: vi.fn(),
}));

const actor = vi.mocked(requireVerifiedDsgActor);
const auth0 = vi.mocked(verifyDsgAuth0Principal);
const db = vi.mocked(readDsgRest);
const config = vi.mocked(getDsgSupabaseRpcConfig);
const original = process.env.DSG_KAGGLE_OWNER_DISPATCH_TOKEN;
const originalService = process.env.DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY;
const request = (body: unknown = { action: 'start_free_gpu', accessToken: 'dummy-owner-jwt' }, origin = 'https://dsg.pics') =>
  new NextRequest('https://dsg.pics/api/dsg/agent-v0/launch', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const response = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300, status,
  json: async () => data,
});

describe('owner-signed free Kaggle Workroom start', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    process.env.DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY = 'server-only-dummy';
    delete process.env.DSG_KAGGLE_OWNER_DISPATCH_TOKEN;
    actor.mockReset();
    auth0.mockReset();
    db.mockReset();
    config.mockReset();
    actor.mockResolvedValue({ actorId: 'actor-1', workspaceId: 'workspace-1', role: 'OWNER' });
    auth0.mockResolvedValue({
      subject: 'auth0|owner', issuer: 'https://dev-kcddqmnusbxxo25s.us.auth0.com/',
      clientId: 'mLIAcMEAhuVDaUvzXn8Qo54zj2llFp3X', scope: 'dsg.use',
      hasApprovalScope: false,
    });
    config.mockReturnValue({ key: 'server-only-dummy', url: 'https://example.test' } as never);
    db.mockResolvedValue([{
      actor_id: 'actor-1', auth0_sub: 'auth0|owner',
      auth0_issuer: 'https://dev-kcddqmnusbxxo25s.us.auth0.com/',
      auth0_client_id: 'mLIAcMEAhuVDaUvzXn8Qo54zj2llFp3X',
    }] as never);
  });
  afterEach(() => {
    if (original) process.env.DSG_KAGGLE_OWNER_DISPATCH_TOKEN = original;
    else delete process.env.DSG_KAGGLE_OWNER_DISPATCH_TOKEN;
    if (originalService) process.env.DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY = originalService;
    else delete process.env.DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY;
    vi.unstubAllGlobals();
  });

  it('denies cross-origin, missing site owner, viewer and invalid body before dispatch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await POST(request(undefined, 'https://evil.example'))).status).toBe(403);
    actor.mockResolvedValueOnce({ actorId: 'viewer', workspaceId: 'workspace-1', role: 'VIEWER' });
    expect((await POST(request())).status).toBe(403);
    actor.mockRejectedValueOnce(new Error('DSG_AUTH_REQUIRED'));
    expect((await POST(request())).status).toBe(401);
    expect((await POST(request({ action: 'paid_gpu', accessToken: 'dummy' }))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects missing/foreign Auth0 subject and unsafe approver class', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    auth0.mockResolvedValueOnce(null);
    expect((await POST(request())).status).toBe(401);
    auth0.mockResolvedValueOnce({
      subject: 'auth0|owner', issuer: 'https://dev-kcddqmnusbxxo25s.us.auth0.com/',
      clientId: 'mLIAcMEAhuVDaUvzXn8Qo54zj2llFp3X', scope: 'dsg.use', hasApprovalScope: true,
    });
    expect((await POST(request())).status).toBe(401);
    db.mockResolvedValueOnce([{ actor_id: 'actor-1', auth0_sub: 'auth0|different',
      auth0_issuer: 'https://dev-kcddqmnusbxxo25s.us.auth0.com/',
      auth0_client_id: 'mLIAcMEAhuVDaUvzXn8Qo54zj2llFp3X' }] as never);
    expect((await POST(request())).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed without server-only owner dispatch token', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const r = await POST(request());
    expect(r.status).toBe(503);
    expect((await r.json()).error).toBe('KAGGLE_OWNER_DISPATCH_NOT_CONFIGURED');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('requires GitHub owner identity and blocks active/recent dispatch', async () => {
    process.env.DSG_KAGGLE_OWNER_DISPATCH_TOKEN = 'test-owner-token';
    const mock = vi.fn().mockResolvedValueOnce(response({ login: 'bot[bot]' }));
    vi.stubGlobal('fetch', mock);
    const foreign = await POST(request());
    expect(foreign.status).toBe(403);
    expect(mock).toHaveBeenCalledTimes(1);

    mock.mockReset();
    mock.mockResolvedValueOnce(response({ login: 'tdealer01-crypto' }))
      .mockResolvedValueOnce(response({ workflow_runs: [{
        id: 123, status: 'in_progress', created_at: '2026-10-21T00:00:00Z',
      }] }));
    const busy = await POST(request());
    expect(busy.status).toBe(409);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('dispatches exactly one existing free-only owner workflow without claiming GPU READY', async () => {
    process.env.DSG_KAGGLE_OWNER_DISPATCH_TOKEN = 'test-owner-token';
    const mock = vi.fn().mockResolvedValueOnce(response({ login: 'tdealer01-crypto' }))
      .mockResolvedValueOnce(response({ workflow_runs: [] }))
      .mockResolvedValueOnce({ ok: true, status: 204 });
    vi.stubGlobal('fetch', mock);
    const r = await POST(request());
    expect(r.status).toBe(202);
    expect(await r.json()).toMatchObject({
      ok: true, status: 'OWNER_DISPATCH_ACCEPTED', gpuState: 'UNVERIFIED',
    });
    expect(mock).toHaveBeenCalledTimes(3);
    const [url, init] = mock.mock.calls[2];
    expect(url).toBe(
      'https://api.github.com/repos/tdealer01-crypto/DSG-Private-Production-Runtime/actions/workflows/launch-kaggle-brain-oidc.yml/dispatches');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      ref: 'main', inputs: { confirm: 'LAUNCH_DSG_KAGGLE_BRAIN', execution_runner: 'github-hosted' },
    });
    expect(JSON.stringify(await POST(request()).then(x => x.json()))).not.toContain('test-owner-token');
  });
});
