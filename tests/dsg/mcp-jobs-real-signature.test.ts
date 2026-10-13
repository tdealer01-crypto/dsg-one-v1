import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { callDsgRpc, readDsgRest, getDsgSupabaseRpcConfig } from '@/lib/dsg/server/supabase-rpc';
import { listAppBuilderJobs } from '@/lib/dsg/server/app-builder/repository';
import { GET } from '../../app/api/dsg/app-builder/jobs/oauth/route';

// JOSE is NOT mocked: this suite verifies a real Ed25519 signature and
// intended downstream audience before any workspace data access.
vi.mock('@/lib/dsg/server/supabase-rpc', () => ({
  callDsgRpc: vi.fn(),
  getDsgSupabaseRpcConfig: vi.fn(),
  readDsgRest: vi.fn(),
  getBearerToken: vi.fn(),
}));
vi.mock('@/lib/dsg/server/app-builder/repository', () => ({
  listAppBuilderJobs: vi.fn(),
}));

const consume = vi.mocked(callDsgRpc);
const db = vi.mocked(readDsgRest);
const cfg = vi.mocked(getDsgSupabaseRpcConfig);
const jobs = vi.mocked(listAppBuilderJobs);
const workspace = 'f372bca8-1a9b-49ea-9cb3-52af54235cf0';
const client = 'tpc_testVerifiedClient123456';
const issuer = 'urn:dsg:spacetime:jobs-delegation';
const audience = 'https://dsg.pics/api/dsg/app-builder/jobs/oauth';
let privateKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];

beforeAll(async () => {
  const keys = await generateKeyPair('EdDSA', { extractable: true });
  privateKey = keys.privateKey;
  const jwk = await exportJWK(keys.publicKey);
  if (!jwk.x) throw new Error('TEST_PUBLIC_KEY_UNAVAILABLE');
  vi.stubEnv('DSG_SPACETIME_JOBS_DELEGATION_PUBLIC_KEY_B64',
    Buffer.from(jwk.x, 'base64url').toString('base64'));
});

beforeEach(() => {
  consume.mockReset().mockResolvedValue(true);
  vi.stubEnv('DSG_SPACETIME_CHATGPT_CLIENT_ID', client);
  vi.stubEnv('DSG_ONE_V1_SUPABASE_URL', 'https://fake-test-project.supabase.co');
  vi.stubEnv('DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY', 'sb_secret_test_only');
  cfg.mockReturnValue({ url: 'https://fake-test-project.supabase.co', key: 'sb_secret_test_only' });
  db.mockReset().mockResolvedValueOnce([{
    actor_id: 'actor-1', auth0_sub: 'auth0|test-user',
    auth0_issuer: 'https://dev-kcddqmnusbxxo25s.us.auth0.com/',
    auth0_client_id: 'mLIAcMEAhuVDaUvzXn8Qo54zj2llFp3X',
  }] as never).mockResolvedValueOnce([{ role: 'OWNER' }] as never);
  jobs.mockReset().mockResolvedValue([] as never);
});
afterAll(() => vi.unstubAllEnvs());

async function receipt(overrides: Record<string, unknown> = {}) {
  const payload = {
    sub: 'auth0|test-user', azp: client,
    auth0_iss: 'https://dev-kcddqmnusbxxo25s.us.auth0.com/',
    scope: 'dsg.jobs.read', workspace_id: workspace,
    route_id: 'route.dsg-one-v1.mcp.list-app-builder-jobs',
    plan_id: 'plan-215', plan_hash: 'a'.repeat(64),
    decision_hash: 'b'.repeat(64), verdict: 'ALLOW',
    ...overrides,
  };
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'EdDSA' })
    .setIssuer(issuer).setAudience(audience)
    .setIssuedAt().setNotBefore('0s').setExpirationTime('25s')
    .setJti('unique-test-receipt-215-12345')
    .sign(privateKey);
}
function request(token: string) {
  return new Request(audience, {
    headers: { authorization: 'Bearer ' + token, 'x-dsg-workspace-id': workspace },
  });
}

describe('real Ed25519 verified DSG downstream Jobs route', () => {
  it('accepts only the pinned signer + exact plan/route/workspace for read', async () => {
    const res = await GET(request(await receipt()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: [] });
    expect(db).toHaveBeenCalledTimes(2);
    expect(jobs).toHaveBeenCalledTimes(1);
  });

  it('rejects a correctly signed JWT for the upstream AWS OAuth audience', async () => {
    const token = await new SignJWT({
      sub: 'auth0|test-user', azp: client,
      auth0_iss: 'https://dev-kcddqmnusbxxo25s.us.auth0.com/',
      scope: 'dsg.jobs.read', workspace_id: workspace,
      route_id: 'route.dsg-one-v1.mcp.list-app-builder-jobs',
      plan_id: 'plan-215', plan_hash: 'a'.repeat(64),
      decision_hash: 'b'.repeat(64), verdict: 'ALLOW',
    }).setProtectedHeader({ alg: 'EdDSA' }).setIssuer(issuer)
      .setAudience('https://aws.dsg.pics').setIssuedAt()
      .setExpirationTime('25s').setJti('unique-test-receipt-215-12345')
      .sign(privateKey);
    const res = await GET(request(token));
    expect(res.status).toBe(401);
    expect(jobs).not.toHaveBeenCalled();
  });

  it('rejects a tampered JWS signature', async () => {
    const token = await receipt();
    const parts = token.split('.');
    parts[1] = parts[1]!.slice(0, -1) + (parts[1]!.slice(-1) === 'A' ? 'B' : 'A');
    const res = await GET(request(parts.join('.')));
    expect(res.status).toBe(401);
    expect(jobs).not.toHaveBeenCalled();
  });

  it.each([
    [{ verdict: 'BLOCK' }, 'blocked decision'],
    [{ workspace_id: '3bbf89a3-82c7-487b-ae52-3091c593cc42' }, 'wrong workspace'],
    [{ route_id: 'route.dsg-one-v1.mcp.create-app-builder-job' }, 'different route'],
    [{ plan_hash: 'bad' }, 'wrong plan hash'],
  ])('rejects signed but disallowed claims: %s (%s)', async (override: Record<string, unknown>, _label: string) => {
    const res = await GET(request(await receipt(override)));
    expect(res.status).toBe(401);
    expect(jobs).not.toHaveBeenCalled();
  });
});
