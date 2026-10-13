import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../../app/api/mcp-server/route';

const workspaceId = 'f372bca8-1a9b-49ea-9cb3-52af54235cf0';

function mcpRequest(args: Record<string, unknown>, extraHeaders: Record<string, string> = {}) {
  return new Request('https://dsg.pics/api/mcp-server', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 'job-read-1', method: 'tools/call',
      params: { name: 'list_app_builder_jobs', arguments: args },
    }),
  });
}
async function mcpResult(request: Request) {
  const res = await POST(request);
  const rpc = await res.json();
  return JSON.parse(rpc.result.content[0].text) as Record<string, unknown>;
}

describe('DSG ONE MCP jobs tool only forwards signed user bearer and selected workspace', () => {
  beforeEach(() => {
    vi.stubEnv('APP_URL', 'https://dsg.pics');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://dsg.pics');
    vi.stubEnv('INTERNAL_SERVICE_TOKEN', 'server-token-not-a-user');
    // Exercise the enabled source-only path; production remains default-OFF.
    vi.stubEnv('DSG_SPACETIME_JOBS_DELEGATION_ACTIVE', 'true');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('rejects service credential fallback instead of forwarding owner privileges', async () => {
    const outbound = vi.fn();
    vi.stubGlobal('fetch', outbound);
    const result = await mcpResult(mcpRequest({ workspaceId }, {
      cookie: 'sb-access-token=a-cookie-not-user-delegation',
      'x-dsg-api-key': 'mcp-service-key',
    }));
    expect(result).toEqual({ ok: false, error: { code: 'DSG_MCP_USER_OAUTH_REQUIRED' } });
    expect(outbound).not.toHaveBeenCalled();
  });

  it('does not route arbitrary workspace strings to the authenticated endpoint', async () => {
    const outbound = vi.fn();
    vi.stubGlobal('fetch', outbound);
    const result = await mcpResult(mcpRequest({ workspaceId: 'demo-workspace' }, { authorization: 'Bearer signed-jwt' }));
    expect(result).toEqual({ ok: false, error: { code: 'DSG_MCP_WORKSPACE_SELECTION_REQUIRED' } });
    expect(outbound).not.toHaveBeenCalled();
  });

  it('forwards only user authorization and workspace selector, never cookies or service API key', async () => {
    const outbound = vi.fn(async (_url: string, _init: RequestInit) =>
      Response.json({ ok: true, data: [] }));
    vi.stubGlobal('fetch', outbound);
    const result = await mcpResult(mcpRequest({ workspaceId }, {
      authorization: 'Bearer opaque-end-user-signed-token',
      cookie: 'sb-access-token=unsafe-user-cookie',
      'x-dsg-api-key': 'service-key',
      'x-dsg-actor-role': 'OWNER',
      'x-dsg-actor-id': 'forged-id',
    }));
    expect(result).toEqual({ ok: true, data: [] });
    expect(outbound).toHaveBeenCalledTimes(1);
    const [url, init] = outbound.mock.calls[0]!;
    expect(url).toBe('https://dsg.pics/api/dsg/app-builder/jobs/oauth');
    expect(init.method).toBe('GET');
    expect(init.cache).toBe('no-store');
    expect(init.headers).toEqual({
      Authorization: 'Bearer opaque-end-user-signed-token',
      'x-dsg-workspace-id': workspaceId,
    });
  });

  it('advertises an explicit UUID workspace input without client-controlled credentials', async () => {
    const req = new Request('https://dsg.pics/api/mcp-server', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
    });
    const res = await POST(req);
    const rpc = await res.json();
    const tool = rpc.result.tools.find((x: { name: string }) => x.name === 'list_app_builder_jobs');
    expect(tool.inputSchema.required).toEqual(['workspaceId']);
    expect(tool.inputSchema.additionalProperties).toBe(false);
    expect(tool.inputSchema.properties).not.toHaveProperty('token');
    expect(tool.inputSchema.properties).not.toHaveProperty('principal');
  });
});
