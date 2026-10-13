import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importJWK, jwtVerify } from 'jose';
import { callDsgRpc, getDsgSupabaseRpcConfig, readDsgRest } from '@/lib/dsg/server/supabase-rpc';
import { listAppBuilderJobs } from '@/lib/dsg/server/app-builder/repository';
import { GET } from '../../app/api/dsg/app-builder/jobs/oauth/route';

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => () => undefined),
  importJWK: vi.fn(async () => ({})),
  jwtVerify: vi.fn(),
}));
vi.mock('@/lib/dsg/server/supabase-rpc', () => ({
  callDsgRpc: vi.fn(),
  getDsgSupabaseRpcConfig: vi.fn(),
  readDsgRest: vi.fn(),
  getBearerToken: vi.fn(),
}));
vi.mock('@/lib/dsg/server/app-builder/repository', () => ({
  listAppBuilderJobs: vi.fn(),
}));

const tokenVerifier = vi.mocked(jwtVerify);
const keyImporter = vi.mocked(importJWK);
const consume = vi.mocked(callDsgRpc);
const db = vi.mocked(readDsgRest);
const dbConfig = vi.mocked(getDsgSupabaseRpcConfig);
const jobs = vi.mocked(listAppBuilderJobs);
const workspaceId = 'f372bca8-1a9b-49ea-9cb3-52af54235cf0';
const otherWorkspaceId = '3bbf89a3-82c7-487b-ae52-3091c593cc42';
const jwt = 'x'.repeat(120); // mock signed delegation assertion, never an upstream Auth0 access token
const user = 'auth0|linked-user';
const websiteClient = 'mLIAcMEAhuVDaUvzXn8Qo54zj2llFp3X';
const pluginClient = 'tpc_testVerifiedClient123456';

const membership = { role: 'OWNER' };
function request(options: { token?: string; workspace?: string; headers?: Record<string, string> } = {}) {
  return new Request('https://dsg.pics/api/dsg/app-builder/jobs/oauth', {
    method: 'GET',
    headers: {
      ...(options.token === '' ? {} : { authorization: 'Bearer ' + (options.token ?? jwt) }),
      ...(options.workspace === '' ? {} : { 'x-dsg-workspace-id': options.workspace ?? workspaceId }),
      ...(options.headers ?? {}),
    },
  });
}
function signedClaims(overrides: Record<string, unknown> = {}) {
  return {
    payload: {
      sub: user,
      iss: 'urn:dsg:spacetime:jobs-delegation',
      aud: 'https://dsg.pics/api/dsg/app-builder/jobs/oauth',
      auth0_iss: 'https://dev-kcddqmnusbxxo25s.us.auth0.com/',
      workspace_id: workspaceId,
      route_id: 'route.dsg-one-v1.mcp.list-app-builder-jobs',
      plan_id: 'bound-plan-215',
      plan_hash: 'a'.repeat(64),
      decision_hash: 'b'.repeat(64),
      verdict: 'ALLOW',
      jti: 'unpredictable-test-nonce-215',
      nbf: Math.floor(Date.now() / 1000) - 5,
      azp: pluginClient,
      iat: Math.floor(Date.now() / 1000) - 5,
      exp: Math.floor(Date.now() / 1000) + 20,
      scope: 'dsg.jobs.read',
      ...overrides,
    },
  };
}
function linkedAccount() {
  return {
    actor_id: 'actor-1',
    auth0_sub: user,
    auth0_issuer: 'https://dev-kcddqmnusbxxo25s.us.auth0.com/',
    auth0_client_id: websiteClient,
  };
}

describe('MCP App Builder signed route/plan delegation (inactive until signer wiring)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    consume.mockResolvedValue(true);
    // These cases exercise signed authorization behind the owner-controlled
    // feature flag. Separate direct-endpoint tests assert the default-off gate.
    vi.stubEnv('DSG_SPACETIME_JOBS_DELEGATION_ACTIVE', 'true');
    vi.stubEnv('DSG_SPACETIME_CHATGPT_CLIENT_ID', pluginClient);
    vi.stubEnv('DSG_SPACETIME_JOBS_DELEGATION_PUBLIC_KEY_B64', Buffer.alloc(32, 7).toString('base64'));
    vi.stubEnv('DSG_ONE_V1_SUPABASE_URL', 'https://dsg-project.supabase.co');
    vi.stubEnv('DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY', 'sb_secret_test_only');
    dbConfig.mockReturnValue({ url: 'https://dsg-project.supabase.co', key: 'sb_secret_test_only' });
    tokenVerifier.mockResolvedValue(signedClaims() as never);
    db.mockResolvedValueOnce([linkedAccount()] as never)
      .mockResolvedValueOnce([membership] as never);
    jobs.mockResolvedValue([] as never);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('reads only linked user membership after an EdDSA signed plan-bound delegation', async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, data: [] });
    expect(jobs).toHaveBeenCalledWith({
      actorId: 'actor-1', workspaceId, actorRole: 'OWNER', permission: 'job:read',
    }, { timeoutMs: 5_000 });
    expect(db).toHaveBeenCalledTimes(2);
    expect(db.mock.calls[0]?.[1]).toBe('dsg_auth0_identity_links');
    expect(db.mock.calls[1]?.[1]).toBe('dsg_workspace_members');
    expect(db.mock.calls[1]?.[2]).toMatchObject({ workspace_id: 'eq.' + workspaceId, actor_id: 'eq.actor-1' });
    expect(tokenVerifier.mock.calls[0]?.[2]).toMatchObject({
      issuer: 'urn:dsg:spacetime:jobs-delegation',
      audience: 'https://dsg.pics/api/dsg/app-builder/jobs/oauth',
      algorithms: ['EdDSA'],
    });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(keyImporter).toHaveBeenCalledWith(expect.objectContaining({ kty: 'OKP', crv: 'Ed25519' }), 'EdDSA');
  });

  it('blocks missing delegation even with spoofed actor and role headers', async () => {
    const response = await GET(request({ token: '', headers: {
      'x-dsg-actor-id': 'actor-1', 'x-dsg-actor-role': 'OWNER',
    } }));
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe('DSG_MCP_USER_OAUTH_REQUIRED');
    expect(tokenVerifier).not.toHaveBeenCalled();
    expect(db).not.toHaveBeenCalled();
    expect(jobs).not.toHaveBeenCalled();
  });

  it('does not accept a delegation carried as a cookie or static x-dsg-api-key', async () => {
    const response = await GET(request({ token: '', headers: {
      cookie: 'sb-access-token=' + jwt + '; dsg-workspace-id=' + workspaceId,
      'x-dsg-api-key': 'server-api-key',
    } }));
    expect(response.status).toBe(401);
    expect(jobs).not.toHaveBeenCalled();
  });

  it('requires an out-of-band pinned Ed25519 delegation public key', async () => {
    vi.stubEnv('DSG_SPACETIME_JOBS_DELEGATION_PUBLIC_KEY_B64', '');
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe('DSG_MCP_DELEGATION_KEY_NOT_CONFIGURED');
    expect(tokenVerifier).not.toHaveBeenCalled();
    expect(jobs).not.toHaveBeenCalled();
  });

  it('rejects malformed signer public key without falling back to a caller-provided key', async () => {
    vi.stubEnv('DSG_SPACETIME_JOBS_DELEGATION_PUBLIC_KEY_B64', Buffer.alloc(31, 1).toString('base64'));
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(tokenVerifier).not.toHaveBeenCalled();
  });

  it('rejects absent and malformed workspace selectors before the database is queried', async () => {
    for (const workspace of ['', 'admin-workspace', 'id);select=*']) {
      const response = await GET(request({ workspace }));
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe('DSG_MCP_WORKSPACE_SELECTION_REQUIRED');
    }
    expect(db).not.toHaveBeenCalled();
    expect(jobs).not.toHaveBeenCalled();
  });

  it('fails closed unless the exact pinned ChatGPT OAuth client is configured', async () => {
    vi.stubEnv('DSG_SPACETIME_CHATGPT_CLIENT_ID', '');
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe('DSG_MCP_OAUTH_CLIENT_NOT_CONFIGURED');
    expect(tokenVerifier).not.toHaveBeenCalled();
  });

  it.each([
    [{ azp: 'evil-client' }, 'wrong signed client'],
    [{ scope: 'dsg.approve dsg.use' }, 'reject human approval scope'],
    [{ scope: 'openid email' }, 'missing delegated jobs read scope'],
    [{ aud: 'https://aws.dsg.pics' }, 'wrong resource audience'],
    [{ route_id: 'route.dsg-one-v1.mcp.create-app-builder-job' }, 'wrong governed route'],
    [{ verdict: 'BLOCK' }, 'denied plan decision'],
    [{ workspace_id: otherWorkspaceId }, 'workspace not bound to receipt'],
    [{ plan_hash: '0'.repeat(63) }, 'invalid plan hash'],
    [{ decision_hash: '0'.repeat(63) }, 'invalid decision hash'],
    [{ exp: Math.floor(Date.now() / 1000) + 600 }, 'overlong delegation expiry'],
    [{ iat: Math.floor(Date.now() / 1000) - 120 }, 'stale delegation'],
    [{ jti: 'short' }, 'unbound replay nonce'],
    [{ auth0_iss: 'https://evil.example/' }, 'wrong upstream issuer'],
    [{ sub: 'x'.repeat(221) }, 'oversized principal'],
    [{ iat: Math.floor(Date.now() / 1000) + 600 }, 'future issue time'],
  ])('rejects %s (%s) without querying membership', async (payload, _description) => {
    if ('aud' in payload) {
      // JOSE itself enforces configured JWT audience before returning claims.
      tokenVerifier.mockRejectedValue(new Error('JWTClaimValidationFailed: audience'));
    } else {
      tokenVerifier.mockResolvedValue(signedClaims(payload) as never);
    }
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe('DSG_MCP_DELEGATION_INVALID');
    expect(jobs).not.toHaveBeenCalled();
    expect(db).not.toHaveBeenCalled();
  });

  it('fails closed when JOSE rejects delegation signature, issuer, audience or expiry', async () => {
    tokenVerifier.mockRejectedValue(new Error('JWT signature verification failed'));
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe('DSG_MCP_DELEGATION_INVALID');
    expect(db).not.toHaveBeenCalled();
  });

  it('rejects signed identities that were never explicitly linked to a website actor', async () => {
    db.mockReset().mockResolvedValueOnce([] as never);
    const response = await GET(request());
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe('DSG_MCP_USER_ACCOUNT_NOT_LINKED');
    expect(jobs).not.toHaveBeenCalled();
  });

  it('rejects links whose issuer or originating website client does not match', async () => {
    db.mockReset().mockResolvedValueOnce([{ ...linkedAccount(), auth0_client_id: 'forged-client' }] as never);
    const response = await GET(request());
    expect(response.status).toBe(403);
    expect(jobs).not.toHaveBeenCalled();
  });

  it('rejects an OAuth user who is not a member of the selected workspace', async () => {
    db.mockReset().mockResolvedValueOnce([linkedAccount()] as never)
      .mockResolvedValueOnce([] as never);
    tokenVerifier.mockResolvedValue(signedClaims({ workspace_id: otherWorkspaceId }) as never);
    const response = await GET(request({ workspace: otherWorkspaceId }));
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe('DSG_MCP_WORKSPACE_ACCESS_DENIED');
    expect(jobs).not.toHaveBeenCalled();
  });

  it('supports read-only VIEWER membership but never confers create, approval or deploy permission', async () => {
    db.mockReset().mockResolvedValueOnce([linkedAccount()] as never)
      .mockResolvedValueOnce([{ role: 'VIEWER' }] as never);
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(jobs).toHaveBeenCalledWith(expect.objectContaining({ actorRole: 'VIEWER', permission: 'job:read' }), { timeoutMs: 5_000 });
  });

  it('returns bounded database failure without SQL or private row disclosure', async () => {
    db.mockReset().mockRejectedValue(new Error('relation secret_customer_table does not exist'));
    const response = await GET(request());
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).toContain('DSG_MCP_IDENTITY_LINK_STORE_UNAVAILABLE');
    expect(text).not.toContain('secret_customer_table');
    expect(jobs).not.toHaveBeenCalled();
  });

  it('rejects missing server-only database credentials without falling back to public or generic keys', async () => {
    vi.stubEnv('DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'generic-service-role');
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe('DSG_MCP_JOBS_DB_NOT_CONFIGURED');
    expect(db).not.toHaveBeenCalled();
  });
});
