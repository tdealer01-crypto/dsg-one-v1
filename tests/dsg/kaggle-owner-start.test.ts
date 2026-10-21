import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { requireVerifiedDsgActor } from '@/lib/dsg/server/context';
import { verifyDsgAuth0Principal } from '@/lib/dsg/server/auth0-identity';
import { getDsgSupabaseRpcConfig, readDsgRest } from '@/lib/dsg/server/supabase-rpc';
import { runKaggleSsmBridge } from '@/lib/dsg/server/kaggle-ssm-bridge';
import { POST } from '@/app/api/dsg/agent-v0/launch/route';

vi.mock('@/lib/dsg/server/context', () => ({ requireVerifiedDsgActor: vi.fn() }));
vi.mock('@/lib/dsg/server/kaggle-ssm-bridge', () => ({ runKaggleSsmBridge: vi.fn() }));
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
const bridge = vi.mocked(runKaggleSsmBridge);
const originalService = process.env.DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY;
const request = (body: unknown = { action: 'start_free_gpu', accessToken: 'dummy-owner-jwt' }, origin = 'https://dsg.pics') =>
  new NextRequest('https://dsg.pics/api/dsg/agent-v0/launch', {
    method: 'POST', headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('secure owner Kaggle Workroom launch with SSM', () => {
  beforeEach(() => {
    process.env.DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY = 'server-only-dummy';
    actor.mockReset(); auth0.mockReset(); db.mockReset(); config.mockReset(); bridge.mockReset();
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
    bridge.mockResolvedValue({
      httpStatus: 202, ok: true, status: 'OWNER_DISPATCH_ACCEPTED', gpuState: 'UNVERIFIED',
    });
  });
  afterEach(() => {
    if (originalService === undefined) delete process.env.DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY;
    else process.env.DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY = originalService;
    vi.clearAllMocks();
  });

  it('blocks origin, viewer, no owner, and arbitrary launch action before SSM', async () => {
    expect((await POST(request(undefined, 'https://evil.example'))).status).toBe(403);
    actor.mockResolvedValueOnce({ actorId: 'viewer', workspaceId: 'workspace-1', role: 'VIEWER' });
    expect((await POST(request())).status).toBe(403);
    actor.mockRejectedValueOnce(new Error('DSG_AUTH_REQUIRED'));
    expect((await POST(request())).status).toBe(401);
    expect((await POST(request({ action: 'paid_gpu', accessToken: 'dummy' }))).status).toBe(400);
    expect(bridge).not.toHaveBeenCalled();
  });

  it('rejects unverified Auth0, approver JWT and mismatched site-linked subject', async () => {
    auth0.mockResolvedValueOnce(null);
    expect((await POST(request())).status).toBe(401);
    auth0.mockResolvedValueOnce({
      subject: 'auth0|owner', issuer: 'https://dev-kcddqmnusbxxo25s.us.auth0.com/',
      clientId: 'mLIAcMEAhuVDaUvzXn8Qo54zj2llFp3X', scope: 'dsg.use',
      hasApprovalScope: true,
    });
    expect((await POST(request())).status).toBe(401);
    db.mockResolvedValueOnce([{
      actor_id: 'actor-1', auth0_sub: 'auth0|different',
      auth0_issuer: 'https://dev-kcddqmnusbxxo25s.us.auth0.com/',
      auth0_client_id: 'mLIAcMEAhuVDaUvzXn8Qo54zj2llFp3X',
    }] as never);
    expect((await POST(request())).status).toBe(403);
    expect(bridge).not.toHaveBeenCalled();
  });

  it('never claims GPU ready merely because GitHub accepted dispatch', async () => {
    const res = await POST(request());
    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({
      ok: true, status: 'OWNER_DISPATCH_ACCEPTED', gpuState: 'UNVERIFIED',
    });
    expect(bridge).toHaveBeenCalledOnce();
    expect(bridge).toHaveBeenCalledWith('start');
  });

  it('returns safe SSM unavailable and already running verdicts verbatim', async () => {
    bridge.mockResolvedValueOnce({
      httpStatus: 503, ok: false, error: 'KAGGLE_OWNER_SECURE_BRIDGE_UNAVAILABLE',
      gpuState: 'UNVERIFIED',
    });
    expect((await POST(request())).status).toBe(503);
    bridge.mockResolvedValueOnce({
      httpStatus: 409, ok: false, error: 'KAGGLE_LAUNCH_ALREADY_IN_PROGRESS',
      gpuState: 'UNVERIFIED',
    });
    const second = await POST(request());
    expect(second.status).toBe(409);
    expect((await second.json()).error).toBe('KAGGLE_LAUNCH_ALREADY_IN_PROGRESS');
  });
});
