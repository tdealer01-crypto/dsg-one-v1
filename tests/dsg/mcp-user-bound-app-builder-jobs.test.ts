import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jwtVerify } from 'jose';
import { getDsgSupabaseRpcConfig, readDsgRest } from '@/lib/dsg/server/supabase-rpc';
import { listAppBuilderJobs } from '@/lib/dsg/server/app-builder/repository';
import { GET } from '../../app/api/dsg/app-builder/jobs/oauth/route';

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => () => undefined),
  jwtVerify: vi.fn(),
}));
vi.mock('@/lib/dsg/server/supabase-rpc', () => ({
  getDsgSupabaseRpcConfig: vi.fn(),
  readDsgRest: vi.fn(),
  getBearerToken: vi.fn(),
}));
vi.mock('@/lib/dsg/server/app-builder/repository', () => ({
  listAppBuilderJobs: vi.fn(),
}));

const tokenVerifier = vi.mocked(jwtVerify);
const db = vi.mocked(readDsgRest);
const dbConfig = vi.mocked(getDsgSupabaseRpcConfig);
const jobs = vi.mocked(listAppBuilderJobs);
const workspaceId = 'f372bca8-1a9b-49ea-9cb3-52af54235cf0';
const otherWorkspaceId = '3bbf89a3-82c7-487b-ae52-3091c593cc42';
const jwt = 'x'.repeat(120);
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
      iss: 'https://dev-kcddqmnusbxxo25s.us.auth0.com/',
      aud: 'https://aws.dsg.pics',
      azp: pluginClient,
      iat: Math.floor(Date.now() / 1000) - 30,
      exp: Math.floor(Date.now() / 1000) + 300,
      scope: 'dsg.use',
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

describe('MCP App Builder signed OAuth workspace read (inactive until delegated wiring)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('DSG_SPACETIME_CHATGPT_CLIENT_ID', pluginClient);
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

  it('reads only the linked user membership for the requested workspace, never a static service principal', async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, data: [] });
    expect(jobs).toHaveBeenCalledWith({
      actorId: 'actor-1', workspaceId, actorRole: 'OWNER', permission: 'job:read',
    });
    expect(db).toHaveBeenCalledTimes(2);
    expect(db.mock.calls[0]?.[1]).toBe('dsg_auth0_identity_links');
    expect(db.mock.calls[1]?.[1]).toBe('dsg_workspace_members');
    expect(db.mock.calls[1]?.[2]).toMatchObject({ workspace_id: 'eq.' + workspaceId, actor_id: 'eq.actor-1' });
    expect(tokenVerifier.mock.calls[0]?.[2]).toMatchObject({
      issuer: 'https://dev-kcddqmnusbxxo25s.us.auth0.com/',
      audience: 'https://aws.dsg.pics',
      algorithms: ['RS256'],
    });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('blocks missing OAuth even with spoofed actor and role headers', async () => {
    const response = await GET(request({ token: '', headers: {
      'x-dsg-actor-id': 'actor-1', 'x-dsg-actor-role': 'OWNER',
    } }));
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe('DSG_MCP_USER_OAUTH_REQUIRED');
    expect(tokenVerifier).not.toHaveBeenCalled();
    expect(db).not.toHaveBeenCalled();
    expect(jobs).not.toHaveBeenCalled();
  });

  it('does not accept a token carried as a cookie or static x-dsg-api-key', async () => {
    const response = await GET(request({ token: '', headers: {
      cookie: 'sb-access-token=' + jwt + '; dsg-workspace-id=' + workspaceId,
      'x-dsg-api-key': 'server-api-key',
    } }));
    expect(response.status).toBe(401);
    expect(jobs).not.toHaveBeenCalled();
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

  it('fails closed unless the exact signed ChatGPT OAuth client is configured', async () => {
    vi.stubEnv('DSG_SPACETIME_CHATGPT_CLIENT_ID', '');
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe('DSG_MCP_OAUTH_CLIENT_NOT_CONFIGURED');
    expect(tokenVerifier).not.toHaveBeenCalled();
  });

  it.each([
    [{ azp: 'evil-client' }, 'wrong signed client'],
    [{ scope: 'dsg.approve dsg.use' }, 'human approver must not be an agent'],
    [{ scope: 'openid email' }, 'missing dsg.use'],
    [{ sub: 'x'.repeat(221) }, 'oversized principal'],
    [{ iat: Math.floor(Date.now() / 1000) + 600 }, 'future issue time'],
  ])('rejects %s (%s) without querying membership', async (payload, _description) => {
    tokenVerifier.mockResolvedValue(signedClaims(payload) as never);
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe('DSG_MCP_USER_OAUTH_INVALID');
    expect(jobs).not.toHaveBeenCalled();
    expect(db).not.toHaveBeenCalled();
  });

  it('fails closed when JOSE rejects the token signature, issuer, audience or expiry', async () => {
    tokenVerifier.mockRejectedValue(new Error('JWT signature verification failed'));
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe('DSG_MCP_USER_OAUTH_INVALID');
    expect(db).not.toHaveBeenCalled();
  });

  it('rejects Auth0 identities that were never explicitly linked to a website actor', async () => {
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
    expect(jobs).toHaveBeenCalledWith(expect.objectContaining({ actorRole: 'VIEWER', permission: 'job:read' }));
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
