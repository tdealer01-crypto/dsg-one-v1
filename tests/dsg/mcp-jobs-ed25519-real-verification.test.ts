import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { SignJWT } from 'jose';
import { callDsgRpc, getDsgSupabaseRpcConfig, readDsgRest } from '@/lib/dsg/server/supabase-rpc';
import { verifiedMcpAppBuilderReadContext, McpUserJobsDenied } from '@/lib/dsg/server/app-builder/mcp-user-context';

vi.mock('@/lib/dsg/server/supabase-rpc', () => ({
  callDsgRpc: vi.fn(),
  getDsgSupabaseRpcConfig: vi.fn(),
  readDsgRest: vi.fn(),
  getBearerToken: vi.fn(),
}));

const config = vi.mocked(getDsgSupabaseRpcConfig);
const read = vi.mocked(readDsgRest);
const consume = vi.mocked(callDsgRpc);
const user = 'auth0|verified-test-user';
const client = 'tpc_testVerifiedClient123456';
const workspace = 'f372bca8-1a9b-49ea-9cb3-52af54235cf0';
const otherWorkspace = '3bbf89a3-82c7-487b-ae52-3091c593cc42';
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const jwk = publicKey.export({ format: 'jwk' });
const pubB64 = Buffer.from(jwk.x!, 'base64url').toString('base64');
const now = () => Math.floor(Date.now() / 1000);

async function assertion(overrides: Record<string, unknown> = {}) {
  const iat = now();
  const claims = {
    auth0_iss: 'https://dev-kcddqmnusbxxo25s.us.auth0.com/',
    scope: 'dsg.jobs.read',
    azp: client,
    route_id: 'route.dsg-one-v1.mcp.list-app-builder-jobs',
    workspace_id: workspace,
    plan_id: 'verified-test-plan',
    plan_hash: 'a'.repeat(64),
    decision_hash: 'b'.repeat(64),
    verdict: 'ALLOW',
    jti: 'test-session-random-jti-123456',
    ...overrides,
  };
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT' })
    .setIssuer('urn:dsg:spacetime:jobs-delegation')
    .setAudience('https://dsg.pics/api/dsg/app-builder/jobs/oauth')
    .setSubject(user)
    .setIssuedAt(iat)
    .setNotBefore(iat)
    .setExpirationTime(iat + 25)
    .sign(privateKey);
}
function headers(token: string, selection = workspace) {
  return new Headers({ authorization: 'Bearer ' + token, 'x-dsg-workspace-id': selection });
}

describe('Real Ed25519 user-bound delegation verification (no JOSE mocks)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    consume.mockResolvedValue(true);
    vi.stubEnv('DSG_SPACETIME_CHATGPT_CLIENT_ID', client);
    vi.stubEnv('DSG_SPACETIME_JOBS_DELEGATION_PUBLIC_KEY_B64', pubB64);
    vi.stubEnv('DSG_ONE_V1_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY', 'sb_secret_test');
    config.mockReturnValue({ url: 'https://example.supabase.co', key: 'sb_secret_test' });
    read.mockResolvedValueOnce([{
      actor_id: 'actor-test', auth0_sub: user,
      auth0_issuer: 'https://dev-kcddqmnusbxxo25s.us.auth0.com/',
      auth0_client_id: 'mLIAcMEAhuVDaUvzXn8Qo54zj2llFp3X',
    }] as never).mockResolvedValueOnce([{ role: 'VIEWER' }] as never);
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it('verifies the exact actual Python signer vector with real JOSE', async () => {
    const vector = JSON.parse(readFileSync(new URL('../fixtures/jobs-delegation-ed25519-vector.json', import.meta.url), 'utf8'));
    expect(vector.test_only).toBe(true);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(vector.issued_at * 1000));
    vi.stubEnv('DSG_SPACETIME_JOBS_DELEGATION_PUBLIC_KEY_B64', vector.public_key_b64);
    await expect(verifiedMcpAppBuilderReadContext(headers(vector.token))).resolves.toMatchObject({
      actorId: 'actor-test', workspaceId: workspace, permission: 'job:read',
    });
    expect(consume).toHaveBeenCalledTimes(1);
  });

  it('verifies a real Ed25519 signature and scoped membership with no bearer passthrough', async () => {
    const context = await verifiedMcpAppBuilderReadContext(headers(await assertion()));
    expect(context).toEqual({
      workspaceId: workspace, actorId: 'actor-test',
      actorRole: 'VIEWER', permission: 'job:read',
    });
    expect(read).toHaveBeenCalledTimes(2);
    expect(read.mock.calls[1]?.[2]).toMatchObject({ actor_id: 'eq.actor-test', workspace_id: 'eq.' + workspace });
  });

  it.each([
    ['wrong client', { azp: 'tpc_otherVerifiedClient12345' }],
    ['wrong route', { route_id: 'route.dsg-one-v1.mcp.create-app-builder-job' }],
    ['wrong audience scoped claim', { workspace_id: otherWorkspace }],
    ['wrong decision', { verdict: 'BLOCK' }],
  ])('rejects signed but unauthorized %s without a membership lookup', async (_why, claims) => {
    await expect(verifiedMcpAppBuilderReadContext(headers(await assertion(claims))))
      .rejects.toMatchObject({ code: 'DSG_MCP_DELEGATION_INVALID', status: 401 });
    expect(read).not.toHaveBeenCalled();
  });

  it('denies tampered token signature before database lookup', async () => {
    const valid = await assertion();
    const segments = valid.split('.');
    const alteredSignature = (segments[2]![0] === 'A' ? 'B' : 'A') + segments[2]!.slice(1);
    await expect(verifiedMcpAppBuilderReadContext(headers([segments[0],segments[1],alteredSignature].join('.'))))
      .rejects.toBeInstanceOf(McpUserJobsDenied);
    expect(read).not.toHaveBeenCalled();
  });

  it('denies a valid signature whose workspace selector differs from bound workspace', async () => {
    await expect(verifiedMcpAppBuilderReadContext(headers(await assertion(), otherWorkspace)))
      .rejects.toMatchObject({ code: 'DSG_MCP_DELEGATION_INVALID', status: 401 });
    expect(read).not.toHaveBeenCalled();
  });

  it('rejects a different verification key even with an otherwise valid assertion', async () => {
    const another = generateKeyPairSync('ed25519').publicKey.export({ format: 'jwk' });
    vi.stubEnv('DSG_SPACETIME_JOBS_DELEGATION_PUBLIC_KEY_B64', Buffer.from(another.x!, 'base64url').toString('base64'));
    await expect(verifiedMcpAppBuilderReadContext(headers(await assertion())))
      .rejects.toMatchObject({ code: 'DSG_MCP_DELEGATION_INVALID', status: 401 });
    expect(read).not.toHaveBeenCalled();
  });
  it('rejects a repeated real signed assertion after membership checks', async () => {
    const token = await assertion();
    consume.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await verifiedMcpAppBuilderReadContext(headers(token));
    read.mockResolvedValueOnce([{
      actor_id: 'actor-test', auth0_sub: user,
      auth0_issuer: 'https://dev-kcddqmnusbxxo25s.us.auth0.com/',
      auth0_client_id: 'mLIAcMEAhuVDaUvzXn8Qo54zj2llFp3X',
    }] as never).mockResolvedValueOnce([{ role: 'VIEWER' }] as never);
    await expect(verifiedMcpAppBuilderReadContext(headers(token)))
      .rejects.toMatchObject({ code: 'DSG_MCP_DELEGATION_REPLAYED', status: 409 });
    expect(consume).toHaveBeenCalledTimes(2);
    expect(consume.mock.calls[0]?.[2]).toEqual(consume.mock.calls[1]?.[2]);
    expect(JSON.stringify(consume.mock.calls)).not.toContain(token);
    expect(JSON.stringify(consume.mock.calls)).not.toContain(user);
  });

  it.each([null, 'true', { ok: true }])('fails closed on malformed consume response %s', async (response) => {
    consume.mockResolvedValue(response);
    await expect(verifiedMcpAppBuilderReadContext(headers(await assertion())))
      .rejects.toMatchObject({ code: 'DSG_MCP_REPLAY_STORE_UNAVAILABLE', status: 503 });
  });

  it('does not retry an uncertain consume or expose backend details', async () => {
    consume.mockRejectedValue(new Error('private SQL internal details'));
    await expect(verifiedMcpAppBuilderReadContext(headers(await assertion())))
      .rejects.toMatchObject({ message: 'DSG_MCP_REPLAY_STORE_UNAVAILABLE', status: 503 });
    expect(consume).toHaveBeenCalledTimes(1);
  });

  it('does not consume receipts for an unlinked user', async () => {
    read.mockReset().mockResolvedValue([]);
    await expect(verifiedMcpAppBuilderReadContext(headers(await assertion())))
      .rejects.toMatchObject({ status: 403 });
    expect(consume).not.toHaveBeenCalled();
  });

});
