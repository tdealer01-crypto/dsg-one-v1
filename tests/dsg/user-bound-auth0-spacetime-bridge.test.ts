import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { resolveVerifiedDsgActor } from '@/lib/dsg/server/context';
import { verifyDsgAuth0Principal } from '@/lib/dsg/server/auth0-identity';
import { getDsgSupabaseRpcConfig, readDsgRest } from '@/lib/dsg/server/supabase-rpc';
import { POST } from '../../app/api/dsg/spacetime/user-tools/route';
import { toolArgumentsBoundToUser } from '@/lib/dsg/user-bound/tool-arguments';

vi.mock('@/lib/dsg/server/context', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/dsg/server/context')>();
  return { ...original, resolveVerifiedDsgActor: vi.fn() };
});
vi.mock('@/lib/dsg/server/auth0-identity', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/dsg/server/auth0-identity')>();
  return { ...original, verifyDsgAuth0Principal: vi.fn() };
});
vi.mock('@/lib/dsg/server/supabase-rpc', () => ({
  getDsgSupabaseRpcConfig: vi.fn(),
  readDsgRest: vi.fn(),
}));

const actor = vi.mocked(resolveVerifiedDsgActor);
const tokenVerifier = vi.mocked(verifyDsgAuth0Principal);
const config = vi.mocked(getDsgSupabaseRpcConfig);
const linkQuery = vi.mocked(readDsgRest);
const subject = 'auth0|user-123';
const principal = 'oauth:' + subject;
const clientId = 'mLIAcMEAhuVDaUvzXn8Qo54zj2llFp3X';
const issuer = 'https://dev-kcddqmnusbxxo25s.us.auth0.com/';

function request(tool = 'spacetime_read_public_repo', args: Record<string, unknown> = {},
  options: { origin?: string; token?: string; body?: Record<string, unknown> } = {}) {
  return new NextRequest('https://dsg.pics/api/dsg/spacetime/user-tools', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: options.origin ?? 'https://dsg.pics',
    },
    body: JSON.stringify(options.body ?? { tool, arguments: args, accessToken: options.token ?? 'delegated.auth0.jwt' }),
  });
}

describe('DSG User-bound Auth0 → AWS Spacetime bridge', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY', 'role-secret-test');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    actor.mockResolvedValue({ actorId: 'actor-1', workspaceId: 'workspace-1', role: 'OWNER' });
    tokenVerifier.mockResolvedValue({
      subject, issuer, clientId, scope: 'dsg.use',
    });
    config.mockReturnValue({ url: 'https://example.supabase.co', key: 'role-secret-test' } as ReturnType<typeof getDsgSupabaseRpcConfig>);
    linkQuery.mockResolvedValue([{
      actor_id: 'actor-1',
      auth0_sub: subject,
      auth0_issuer: issuer,
      auth0_client_id: clientId,
    }] as never);
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('returns 403 before any identity lookup or MCP call on invalid origin', async () => {
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);
    const response = await POST(request(undefined, {}, { origin: 'https://untrusted.example' }));
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe('ORIGIN_DENIED');
    expect(actor).not.toHaveBeenCalled();
    expect(upstream).not.toHaveBeenCalled();
  });

  it('returns 401 without a verified website actor', async () => {
    actor.mockResolvedValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(tokenVerifier).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects invalid delegated Auth0 JWT even with a valid website session', async () => {
    tokenVerifier.mockResolvedValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe('USER_AUTH0_TOKEN_NOT_VERIFIED');
    expect(linkQuery).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects Auth0 identity not bound to the current signed-in website actor', async () => {
    linkQuery.mockResolvedValue([{
      actor_id: 'actor-1', auth0_sub: 'auth0|another-user', auth0_issuer: issuer, auth0_client_id: clientId,
    }] as never);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe('SITE_AUTH0_SUBJECT_BINDING_MISMATCH');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects missing persistent identity table without falling back to owner credentials', async () => {
    linkQuery.mockRejectedValue(new Error('table not installed'));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe('IDENTITY_LINK_STORE_UNAVAILABLE');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('denies principal injection in compose, approval and execute', () => {
    const impostor = { agent_id: 'dsg-agent', principal: 'customer:owner' };
    const correct = { agent_id: 'dsg-agent', principal };
    expect(toolArgumentsBoundToUser('spacetime_compose', { participants: [impostor] }, subject)).toBe(false);
    expect(toolArgumentsBoundToUser('spacetime_compose', { participants: [correct] }, subject)).toBe(true);
    expect(toolArgumentsBoundToUser('spacetime_execute', { agent: impostor, plan_id: 'p', plan_hash: 'h', route_id: 'r' }, subject)).toBe(false);
    expect(toolArgumentsBoundToUser('spacetime_request_approval', { request: { agent: impostor, plan_id: 'p', plan_hash: 'h', route_id: 'r' } }, subject)).toBe(false);
    expect(toolArgumentsBoundToUser('spacetime_execute', { agent: correct, plan_id: 'p', plan_hash: 'h', route_id: 'r' }, subject)).toBe(true);
  });

  it('prohibits resolving an approval with an agent-class OAuth credential', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await POST(request('spacetime_resolve_approval', { approval_request_id: 'request-1', decision: 'APPROVE' }));
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe('APPROVER_SCOPE_REQUIRED');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('restricts roles: viewer cannot compose, request approval or execute', async () => {
    actor.mockResolvedValue({ actorId: 'actor-1', workspaceId: 'workspace-1', role: 'VIEWER' });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await POST(request('spacetime_execute', {
      agent: { agent_id: 'dsg-agent', principal }, plan_id: 'p', plan_hash: 'h', route_id: 'r',
    }));
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe('DSG_WORKSPACE_PERMISSION_DENIED');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends only verified delegated bearer credential on a fixed AWS endpoint and returns real receipt', async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const { id } = JSON.parse(init.body as string) as { id: string };
      return new Response(JSON.stringify({
      jsonrpc: '2.0', id, result: {
        isError: false,
        structuredContent: {
          decision: { verdict: 'ALLOW' },
          plan_hash: 'planhash-1',
          principal_binding: 'VERIFIED_OAUTH_SUBJECT',
          result: { public: true },
          evidence: { hash: 'evidence-hash-1' },
        },
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);
    const response = await POST(request());
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(data.ok).toBe(true);
    expect(data.userPrincipalVerified).toBe(true);
    expect(data.receipt.plan_hash).toBe('planhash-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, params] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://aws.dsg.pics/mcp');
    const headers = params.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer delegated.auth0.jwt');
    expect(headers['X-DSG-API-Key']).toBeUndefined();
    expect(JSON.parse(params.body as string).params.name).toBe('spacetime_read_public_repo');
    expect(JSON.stringify(data)).not.toContain('delegated.auth0.jwt');
  });

  it('reports evidence verification separately; a successful HTTP response is not proof', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      const { id } = JSON.parse(init.body as string) as { id: string };
      return new Response(JSON.stringify({
        jsonrpc: '2.0', id, result: { isError: false, structuredContent: { valid: false, records: 3 } },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }));
    const response = await POST(request('spacetime_verify_evidence'));
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.evidenceVerified).toBe(false);
    expect(data.receipt.valid).toBe(false);
  });

  it('fails closed on a mismatched JSON-RPC response ID even when provider receipt claims success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      jsonrpc: '2.0', id: 'unrelated-request',
      result: { isError: false, structuredContent: { valid: true, records: 4 } },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    const response = await POST(request('spacetime_verify_evidence'));
    expect(response.status).toBe(502);
    expect((await response.json()).error).toBe('AWS_MCP_RPC_ID_MISMATCH');
  });

  it('parses bounded MCP SSE and matches the exact JSON-RPC call id', async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const rpc = JSON.parse(init.body as string) as { id: string };
      const frame = 'event: message\\ndata: ' + JSON.stringify({
        jsonrpc: '2.0', id: rpc.id,
        result: { isError: false, structuredContent: { valid: true, records: 2 } },
      }) + '\\n\\n';
      return new Response(frame.replaceAll('\\n', '\n'), {
        status: 200, headers: { 'Content-Type': 'text/event-stream' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const res = await POST(request('spacetime_verify_evidence'));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.evidenceVerified).toBe(true);
    expect(data.receipt.valid).toBe(true);
  });

  it('rejects SSE frames unrelated to the requested JSON-RPC id', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      'event: message\\ndata: {"jsonrpc":"2.0","id":"other-call","result":{"structuredContent":{"valid":true}}}\\n\\n'
        .replaceAll('\\n', '\n'),
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
    )));
    const res = await POST(request('spacetime_verify_evidence'));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('AWS_MCP_UNREACHABLE');
  });

  it('fails closed when AWS rejects the real delegated bearer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('unauthorized', { status: 401 })));
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe('AWS_USER_OAUTH_REJECTED');
  });
});
