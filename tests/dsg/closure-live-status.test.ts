import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/public/closure/live-status/route';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('public closure live proof boundary', () => {
  it('reports reachable public infrastructure separately from signed-user and Quest E2E', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/api/agent/status')) return Response.json({
        ok: true, env: 'production', version: 'a'.repeat(40),
        deployment: { sourceBound: true, digestBound: true,
          buildSourceSha: 'a'.repeat(40), expectedSourceSha: 'a'.repeat(40), imageDigest: 'sha256:' + 'b'.repeat(64) },
      });
      if (url.endsWith('/.well-known/oauth-protected-resource')) return Response.json({
        resource: 'https://aws.dsg.pics',
        authorization_servers: ['https://dev-kcddqmnusbxxo25s.us.auth0.com/'],
      });
      return new Response('', { status: 401 });
    }));
    const response = await GET();
    const body = await response.json();
    const states = Object.fromEntries(body.checks.map((c: {id: string; state: string}) => [c.id, c.state]));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body.overall_e2e).toBe('NOT_VERIFIED');
    expect(states['website-runtime']).toBe('VERIFIED');
    expect(states['auth0-metadata']).toBe('REACHABLE');
    expect(states['anonymous-mcp']).toBe('VERIFIED');
    expect(states['unity-build-15']).toBe('HISTORICAL_VERIFIED');
    expect(states['xr-governance-component']).toBe('HISTORICAL_VERIFIED');
    expect(states['unity-runtime']).toBe('NOT_VERIFIED');
    expect(states['quest-hands']).toBe('NOT_VERIFIED');
    expect(states['user-oauth']).toBe('HISTORICAL_VERIFIED');
    const signedRead = body.checks.find((c: {id: string}) => c.id === 'user-oauth');
    expect(signedRead.source).toBe('https://dsg-3.gitbook.io/dsg-docs/control-plane/');
    expect(signedRead.detail).toContain('not a live user OAuth probe');
  });

  it('fails closed on a source mismatch and OAuth metadata mismatch', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/api/agent/status')) return Response.json({
        ok: true, env: 'production', version: 'a'.repeat(40),
        deployment: { sourceBound: true, digestBound: true,
          buildSourceSha: 'f'.repeat(40), expectedSourceSha: 'a'.repeat(40), imageDigest: 'sha256:' + 'b'.repeat(64) },
      });
      if (url.endsWith('/.well-known/oauth-protected-resource'))
        return Response.json({ resource: 'https://other.example', authorization_servers: [] });
      return new Response('unexpected', { status: 200 });
    }));
    const body = await (await GET()).json();
    expect(body.checks.slice(0, 3).every((c: {state: string}) => c.state === 'NOT_VERIFIED')).toBe(true);
    expect(body.overall_e2e).toBe('NOT_VERIFIED');
    expect(body.checks.find((c: {id: string}) => c.id === 'user-oauth').state).toBe('HISTORICAL_VERIFIED');
  });

  it('does not turn network failures into PASS', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('NetworkUnavailable'); }));
    const body = await (await GET()).json();
    expect(body.checks.filter((c: {state: string}) => c.state === 'VERIFIED')).toHaveLength(0);
    expect(body.checks.find((c: {id: string}) => c.id === 'quest-hands').state).toBe('NOT_VERIFIED');
  });
});
