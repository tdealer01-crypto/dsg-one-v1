import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveVerifiedDsgActor } from '@/lib/dsg/server/context';
import { GET } from '../../app/api/dsg/integrations/status/route';

vi.mock('@/lib/dsg/server/context', () => ({ resolveVerifiedDsgActor: vi.fn() }));

const actor = vi.mocked(resolveVerifiedDsgActor);
const url = 'https://dsg.pics/api/dsg/integrations/status';

describe('Unified DSG integration read-only gateway', () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('requires a verified website actor/workspace before any upstream probes', async () => {
    actor.mockResolvedValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = await GET(new Request(url));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('DSG_AUTH_REQUIRED');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports site/metadata reachability without claiming delegated OAuth or provider execution', async () => {
    actor.mockResolvedValue({ actorId: 'actor-1', workspaceId: 'ws-1', role: 'OWNER' });
    const fetchMock = vi.fn(async (target: string, options: RequestInit) => {
      expect(options.headers).toEqual({ Accept: 'application/json' });
      expect(options.method).toBeUndefined();
      if (target.endsWith('/.well-known/oauth-protected-resource')) {
        return new Response(JSON.stringify({
          resource: 'https://aws.dsg.pics',
          authorization_servers: ['https://dev-kcddqmnusbxxo25s.us.auth0.com/'],
        }), { status: 200 });
      }
      if (target === 'https://dsg.pics/api/agent/status') {
        return new Response(JSON.stringify({ ok: true, deployment: { sourceBound: true, digestBound: true } }), { status: 200 });
      }
      throw new Error('unexpected URL');
    });
    vi.stubGlobal('fetch', fetchMock);
    const res = await GET(new Request(url));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(data.authority).toBe('AWS_SPACETIME');
    expect(data.workspace).toEqual({ id: 'ws-1', role: 'OWNER' });
    expect(data.surfaces.spacetime.state).toBe('REACHABLE');
    expect(data.surfaces.dsg_one.state).toBe('REACHABLE');
    expect(data.surfaces.workroom.principal_bound_to_spacetime).toBe(false);
    expect(data.user_oauth_e2e).toBe('NOT_VERIFIED');
    expect(data.provider_execution_e2e).toBe('NOT_VERIFIED');
    expect(data.owner_service_credential_substitution).toBe('FORBIDDEN');
  });

  it('fails closed on wrong OAuth issuer even if upstream returns HTTP 200', async () => {
    actor.mockResolvedValue({ actorId: 'actor-1', workspaceId: 'ws-1', role: 'VIEWER' });
    const fetchMock = vi.fn(async (target: string) =>
      new Response(JSON.stringify(target.endsWith('/.well-known/oauth-protected-resource')
        ? { resource: 'https://aws.dsg.pics', authorization_servers: ['https://untrusted.example/'] }
        : { ok: true, deployment: { sourceBound: true, digestBound: true } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await GET(new Request(url));
    const data = await res.json();
    expect(data.surfaces.spacetime.state).toBe('NOT_VERIFIED');
    expect(data.surfaces.spacetime.metadata.reason).toBe('OAUTH_RESOURCE_MISMATCH');
    expect(data.user_oauth_e2e).toBe('NOT_VERIFIED');
  });

  it('never treats transport health alone as proof of a bound deployment', async () => {
    actor.mockResolvedValue({ actorId: 'actor-1', workspaceId: 'ws-1', role: 'VIEWER' });
    vi.stubGlobal('fetch', vi.fn(async (target: string) =>
      new Response(JSON.stringify(target.endsWith('/.well-known/oauth-protected-resource')
        ? { resource: 'https://aws.dsg.pics', authorization_servers: ['https://dev-kcddqmnusbxxo25s.us.auth0.com/'] }
        : { ok: true, deployment: { sourceBound: false, digestBound: true } }), { status: 200 })));
    const res = await GET(new Request(url));
    const data = await res.json();
    expect(data.surfaces.dsg_one.state).toBe('NOT_VERIFIED');
    expect(data.surfaces.dsg_one.health.reason).toBe('DEPLOYMENT_IDENTITY_NOT_VERIFIED');
  });
});
