import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { resolveVerifiedDsgActor } from '@/lib/dsg/server/context';
import { verifyDsgAuth0Principal } from '@/lib/dsg/server/auth0-identity';
import { getDsgSupabaseRpcConfig, readDsgRest } from '@/lib/dsg/server/supabase-rpc';
import { POST } from '@/app/api/dsg/bounded-plans/route';

vi.mock('@/lib/dsg/server/context', async (original) => ({
  ...await original<typeof import('@/lib/dsg/server/context')>(), resolveVerifiedDsgActor: vi.fn(),
}));
vi.mock('@/lib/dsg/server/auth0-identity', async (original) => ({
  ...await original<typeof import('@/lib/dsg/server/auth0-identity')>(), verifyDsgAuth0Principal: vi.fn(),
}));
vi.mock('@/lib/dsg/server/supabase-rpc', () => ({ getDsgSupabaseRpcConfig: vi.fn(), readDsgRest: vi.fn() }));

const subject = 'auth0|bounded-owner';
const token = 'test-access-token';
const requestId = 'dsg_bp_review_test';
const grantId = 'dsg_bp_test';
const hash = 'a'.repeat(64);
const actor = vi.mocked(resolveVerifiedDsgActor);
const principal = vi.mocked(verifyDsgAuth0Principal);
const config = vi.mocked(getDsgSupabaseRpcConfig);
const links = vi.mocked(readDsgRest);
const execute = {
  plan_id: 'web-plan', plan_hash: hash, route_id: 'route.desktop-native.fs-write',
  agent: { agent_id: 'dsg-web-workroom', principal: 'oauth:' + subject },
  payload: { action: 'device.fs.write', arguments: { path: 'scope/file.txt', content: 'value', mode: 'create_new' } },
};
const stage = () => ({ workspace_id: 'workspace-1', device_id: 'device-1', requests: [structuredClone(execute)] });
const view = () => ({ request_id: requestId, status: 'VIEWED', next_action: 'OWNER_MFA', review_digest: hash,
  scope: { plan_id: 'web-plan', plan_hash: hash, workspace_id: 'workspace-1', device_id: 'device-1',
    agent_id: 'dsg-web-workroom', expires_at: 2000000000,
    steps: [{ step_id: 'step-1', route_id: execute.route_id, payload_hash: hash,
      effect: 'file.create', origin: 'https://dsg.pics', risk: 'high' }] } });
function request(operation = 'stage', args: unknown = stage(), options: { origin?: string; extra?: object; type?: string } = {}) {
  return new NextRequest('https://dsg.pics/api/dsg/bounded-plans', { method: 'POST',
    headers: { Origin: options.origin ?? 'https://dsg.pics', 'Content-Type': options.type ?? 'application/json' },
    body: JSON.stringify({ operation, accessToken: token, arguments: args, ...options.extra }),
  });
}
function upstream(body: object = { request_id: requestId, status: 'PENDING', expires_at: 2000000000, next_action: 'REVIEW_PLAN' }) {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
function approver() {
  principal.mockResolvedValue({ subject, issuer: 'https://dev-kcddqmnusbxxo25s.us.auth0.com/',
    clientId: 'jI1uiKcQu7mqORsaCrogKTQVsAcZuQSt', scope: 'dsg.approve', mfaProofVerified: true });
}

describe('owner bounded-plan HTTP bridge', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY', 'test-role');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    actor.mockResolvedValue({ actorId: 'site-owner', workspaceId: 'workspace-1', role: 'OWNER' });
    principal.mockResolvedValue({ subject, issuer: 'https://dev-kcddqmnusbxxo25s.us.auth0.com/',
      clientId: 'mLIAcMEAhuVDaUvzXn8Qo54zj2llFp3X', scope: 'dsg.use', hasApprovalScope: false });
    config.mockReturnValue({ url: 'https://test.supabase.co', key: 'test-role' } as ReturnType<typeof getDsgSupabaseRpcConfig>);
    links.mockResolvedValue([{ actor_id: 'site-owner', auth0_sub: subject,
      auth0_issuer: 'https://dev-kcddqmnusbxxo25s.us.auth0.com/', auth0_client_id: 'mLIAcMEAhuVDaUvzXn8Qo54zj2llFp3X' }] as never);
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('stages the actual composed request at the one fixed HTTP endpoint', async () => {
    const fetch = upstream();
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, userPrincipalVerified: true, workspaceId: 'workspace-1',
      receipt: { request_id: requestId, status: 'PENDING', expires_at: 2000000000, next_action: 'REVIEW_PLAN' } });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://aws.dsg.pics/owner/bounded-plans/stage');
    expect(init.redirect).toBe('error');
    expect(init.headers.Authorization).toBe('Bearer ' + token);
    expect(JSON.parse(init.body)).toEqual(stage());
    expect(JSON.parse(init.body)).not.toHaveProperty('accessToken');
  });

  it.each(['https://evil.example', 'null', ''])('denies untrusted origin %s before any identity or upstream lookup', async (origin) => {
    const fetch = upstream();
    expect((await POST(request('stage', stage(), { origin }))).status).toBe(403);
    expect(actor).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it('requires JSON and rejects invented operations', async () => {
    const fetch = upstream();
    expect((await POST(request('stage', stage(), { type: 'text/plain' }))).status).toBe(415);
    expect((await POST(request('stage', stage(), { type: 'application/json-invalid' }))).status).toBe(415);
    expect((await POST(request('execute'))).status).toBe(403);
    expect((await POST(request('__proto__'))).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('requires a current verified site actor, including on confirmation', async () => {
    const fetch = upstream(); actor.mockResolvedValue(null); approver();
    expect((await POST(request('confirm', { request_id: requestId, reviewed_digest: hash }))).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects a workspace operator without owner authority', async () => {
    const fetch = upstream(); actor.mockResolvedValue({ actorId: 'site-owner', workspaceId: 'workspace-1', role: 'OPERATOR' });
    expect((await POST(request())).status).toBe(403); expect(fetch).not.toHaveBeenCalled();
  });
  it('requires cryptographically verified requester OAuth', async () => {
    const fetch = upstream(); principal.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401); expect(fetch).not.toHaveBeenCalled();
  });
  it('requires the existing verified site/Auth0 subject link for confirmation too', async () => {
    const fetch = upstream(); approver(); links.mockResolvedValue([{ actor_id: 'site-owner', auth0_sub: 'auth0|someone-else',
      auth0_issuer: 'https://dev-kcddqmnusbxxo25s.us.auth0.com/', auth0_client_id: 'mLIAcMEAhuVDaUvzXn8Qo54zj2llFp3X' }] as never);
    expect((await POST(request('confirm', { request_id: requestId, reviewed_digest: hash }))).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not fall back to an anonymous identity mapping key', async () => {
    const fetch = upstream(); config.mockReturnValue({ url: 'https://test.supabase.co', key: 'anonymous' } as ReturnType<typeof getDsgSupabaseRpcConfig>);
    expect((await POST(request())).status).toBe(503); expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    ['status', { request_id: requestId }],
    ['revoke', { grant_id: grantId }],
  ])('bounds a stalled identity lookup before forwarding %s', async (operation, args) => {
    const actual = await vi.importActual<typeof import('@/lib/dsg/server/supabase-rpc')>('@/lib/dsg/server/supabase-rpc');
    links.mockImplementation(actual.readDsgRest);
    const nativeTimeout = AbortSignal.timeout.bind(AbortSignal);
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => nativeTimeout(1));
    let aborted = false;
    const fetch = vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (!signal) { reject(new Error('Identity lookup has no abort signal')); return; }
      signal.addEventListener('abort', () => { aborted = true; reject(signal.reason); }, { once: true });
    }));
    vi.stubGlobal('fetch', fetch);
    try {
      const response = await POST(request(operation, args));
      expect(response.status).toBe(503);
      expect((await response.json()).error).toBe('IDENTITY_LINK_STORE_UNAVAILABLE');
      expect(timeout).toHaveBeenCalledWith(5000);
      expect(aborted).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(String(fetch.mock.calls[0][0])).toMatch(/^https:\/\/test\.supabase\.co\/rest\/v1\/dsg_auth0_identity_links\?/);
    } finally {
      timeout.mockRestore();
    }
  });
  it('denies approval-scope credentials on requester operations', async () => {
    const fetch = upstream(); approver();
    expect((await POST(request())).status).toBe(403); expect(fetch).not.toHaveBeenCalled();
  });
  it('requires the dedicated approver and signed fresh MFA for confirmation', async () => {
    const fetch = upstream();
    expect((await POST(request('confirm', { request_id: requestId, reviewed_digest: hash }))).status).toBe(403);
    approver(); principal.mockResolvedValueOnce({ subject, issuer: '', clientId: '', scope: 'dsg.approve', mfaProofVerified: false });
    expect((await POST(request('confirm', { request_id: requestId, reviewed_digest: hash }))).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('forwards only the reviewed digest with a real approver token', async () => {
    approver(); const fetch = upstream({ status: 'ACTIVE', grant_id: grantId, grant_digest: hash, review_request_id: requestId, next_action: 'OBSERVE_JOB' });
    const response = await POST(request('confirm', { request_id: requestId, reviewed_digest: hash }));
    expect(response.status).toBe(200);
    expect(principal).toHaveBeenCalledWith(token, 'dsg.approve');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ request_id: requestId, reviewed_digest: hash });
  });
  it('binds stage workspace and every request principal', async () => {
    const fetch = upstream(); const wrongWorkspace = { ...stage(), workspace_id: 'other' };
    expect((await POST(request('stage', wrongWorkspace))).status).toBe(403);
    const wrongPrincipal = stage(); wrongPrincipal.requests[0].agent.principal = 'oauth:other';
    expect((await POST(request('stage', wrongPrincipal))).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects unrelated routes, altered plans, mode omission and embedded permits', async () => {
    const fetch = upstream(); const forbidden = stage(); forbidden.requests[0].route_id = 'route.desktop-native.shell-exec';
    expect((await POST(request('stage', forbidden))).status).toBe(403);
    const changed = stage(); changed.requests.push({ ...structuredClone(execute), plan_hash: 'b'.repeat(64) });
    expect((await POST(request('stage', changed))).status).toBe(403);
    const noMode = stage(); delete (noMode.requests[0].payload.arguments as Record<string, unknown>).mode;
    expect((await POST(request('stage', noMode))).status).toBe(403);
    const permit = stage(); Object.assign(permit.requests[0], { approval_id: 'not-allowed' });
    expect((await POST(request('stage', permit))).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects extra authority fields and oversized input before forwarding', async () => {
    const fetch = upstream();
    expect((await POST(request('status', { request_id: requestId, grant_id: grantId }))).status).toBe(403);
    expect((await POST(request('status', { request_id: requestId }, { extra: { upstream: 'https://evil.example' } }))).status).toBe(400);
    expect((await POST(request('stage', stage(), { extra: { accessToken: { token } } }))).status).toBe(400);
    const big = stage(); big.requests[0].payload.arguments.content = 'x'.repeat(200000);
    expect((await POST(request('stage', big))).status).toBe(400); expect(fetch).not.toHaveBeenCalled();
  });
  it('returns only safe scope metadata and checks response request/workspace binding', async () => {
    const data = view(); Object.assign(data, { signed_envelope: { secret: 'never-return' } });
    upstream(data);
    const response = await POST(request('view', { request_id: requestId }));
    expect(response.status).toBe(200); expect(JSON.stringify(await response.json())).not.toContain('never-return');
    upstream({ ...view(), request_id: 'another-review' });
    expect((await POST(request('view', { request_id: requestId }))).status).toBe(502);
    upstream({ ...view(), scope: { ...view().scope, workspace_id: 'other-workspace' } });
    expect((await POST(request('view', { request_id: requestId }))).status).toBe(502);
  });
  it('stages the advertised cinema connect tuple without adding execution authority', async () => {
    const args = { workspace_id: 'workspace-1', device_id: 'device-1', requests: [{
      ...execute, route_id: 'route.cinema-remote.connect', payload: { action: 'browser.remote.connect',
        arguments: { plan_id: execute.plan_id, agent_identity: execute.agent.agent_id, step_id: 'step-1', ttl_seconds: 300 } },
    }] };
    const fetch = upstream();
    expect((await POST(request('stage', args))).status).toBe(200);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(args);
    args.requests[0].payload.arguments.agent_identity = 'another-agent';
    expect((await POST(request('stage', args))).status).toBe(403);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('reads status with requester OAuth and retains blocked workflow state', async () => {
    const data = { workflow_version: 'dsg.bounded-plan.workflow.v1', request_id: requestId,
      workspace_id: 'workspace-1', device_id: 'device-1', plan_id: 'web-plan', plan_hash: hash,
      status: 'WAITING_WORKER_CONFIGURATION', authorization_status: 'ACTIVE', completion_verified: false,
      completed_steps: 0, total_steps: 1, steps: [{ step_id: 'step-1', route_id: execute.route_id, status: 'PENDING' }],
      next_action: 'CONFIGURE_WORKER', grant_id: grantId, job_id: null, automatic_retry: false };
    const fetch = upstream({ ...data, raw_provider_payload: { secret: 'never-return' } });
    const response = await POST(request('status', { request_id: requestId }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, userPrincipalVerified: true, workspaceId: 'workspace-1', receipt: data });
    expect(principal).toHaveBeenCalledWith(token, 'dsg.use');
    expect(fetch.mock.calls[0][0]).toBe('https://aws.dsg.pics/owner/bounded-plans/status');
  });
  it('revokes only the existing grant and binds the returned grant ID', async () => {
    const fetch = upstream({ status: 'REVOKED', grant_id: grantId });
    expect((await POST(request('revoke', { grant_id: grantId }))).status).toBe(200);
    expect(fetch.mock.calls[0][0]).toBe('https://aws.dsg.pics/owner/bounded-plans/revoke');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ grant_id: grantId });
    upstream({ status: 'REVOKED', grant_id: 'another-grant' });
    expect((await POST(request('revoke', { grant_id: grantId }))).status).toBe(502);
  });
  it('keeps unconfigured and policy-denied results blocked without reflecting upstream secrets', async () => {
    for (const status of [403, 404]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('secret=never-return', { status })));
      const response = await POST(request()); const data = await response.json();
      expect(response.status).toBe(status); expect(data.ok).toBe(false); expect(data.status).toBe('BLOCKED');
      expect(data.nextAction).toBeTypeOf('string'); expect(JSON.stringify(data)).not.toContain('never-return');
    }
  });
  it('fails closed on oversized/malformed or false-completion responses', async () => {
    upstream({ ...view(), surplus: 'x'.repeat(300000) });
    expect((await POST(request('view', { request_id: requestId }))).status).toBe(502);
    upstream({ workflow_version: 'dsg.bounded-plan.workflow.v1', request_id: requestId,
      workspace_id: 'workspace-1', device_id: 'device-1', plan_id: 'web-plan', plan_hash: hash,
      status: 'COMPLETED', authorization_status: 'ACTIVE', completion_verified: true,
      completed_steps: 1, total_steps: 1, steps: [{ step_id: 'step-1', route_id: execute.route_id, status: 'PENDING' }],
      next_action: 'VIEW_EVIDENCE', grant_id: grantId, job_id: 'job-1', automatic_retry: false });
    expect((await POST(request('status', { request_id: requestId }))).status).toBe(502);
  });
  it('marks an uncertain confirmation as readback-only and does not retry', async () => {
    approver(); const fetch = vi.fn().mockRejectedValue(new Error('network error containing secret')); vi.stubGlobal('fetch', fetch);
    const response = await POST(request('confirm', { request_id: requestId, reviewed_digest: hash })); const data = await response.json();
    expect(response.status).toBe(503); expect(data.error).toBe('BOUNDED_PLAN_CONFIRMATION_UNCERTAIN');
    expect(data.nextAction).toMatch(/status/i); expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(data)).not.toContain('containing secret');
  });
});
