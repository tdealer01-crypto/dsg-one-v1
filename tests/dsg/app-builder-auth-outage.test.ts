import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAppBuilderRequestContext } from '@/lib/dsg/server/app-builder/context';
import { classifyAppBuilderJobError } from '@/lib/dsg/server/app-builder/job-error';
import { requireVerifiedDsgActor } from '@/lib/dsg/server/context';

const request = (authenticated = true) => new Request('https://dsg.pics/api/dsg/app-builder/jobs', {
  headers: authenticated ? { Authorization: 'Bearer test-user-token', 'x-dsg-workspace-id': 'workspace-a' } : {},
});

beforeEach(() => {
  vi.stubEnv('DSG_ONE_V1_SUPABASE_URL', 'https://auth.example.test');
  vi.stubEnv('DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY', 'sb_secret_test_only');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('App Builder uses the real actor verifier to distinguish an auth outage', () => {
  it.each([500, 502, 503, 504])('maps auth HTTP %s to bounded 503 without reading its private body', async (status) => {
    let cancelled = 0;
    const fetchMock = vi.fn(async () => new Response(new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode('private auth-service failure')); },
      cancel() { cancelled += 1; },
    }), { status }));
    vi.stubGlobal('fetch', fetchMock);
    const error = await getAppBuilderRequestContext(request(), 'job:read').catch((err: unknown) => err);
    expect(classifyAppBuilderJobError(error)).toEqual({ code: 'APP_BUILDER_AUTH_BACKEND_UNAVAILABLE', status: 503 });
    expect(cancelled).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((error as Error).message).not.toContain('private');
  });

  it.each([401, 403])('keeps rejected credentials at HTTP401 when auth returns %s', async (status) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status })));
    const error = await getAppBuilderRequestContext(request(), 'job:read').catch((err: unknown) => err);
    expect(classifyAppBuilderJobError(error)).toEqual({ code: 'DSG_AUTH_REQUIRED', status: 401 });
  });

  it('missing credentials require sign-in without contacting the provider', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(getAppBuilderRequestContext(request(false), 'job:read')).rejects.toThrow('DSG_AUTH_REQUIRED');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('preserves successful server-verified user and workspace membership', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'user-a' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ role: 'OPERATOR' }]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(getAppBuilderRequestContext(request(), 'job:read')).resolves.toMatchObject({
      actorId: 'user-a', workspaceId: 'workspace-a', actorRole: 'OPERATOR',
    });
    const membership = new URL(String(fetchMock.mock.calls[1][0]));
    expect(membership.searchParams.get('actor_id')).toBe('eq.user-a');
    expect(membership.searchParams.get('workspace_id')).toBe('eq.workspace-a');
  });

  it('keeps other callers at their existing default error contract', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })));
    await expect(requireVerifiedDsgActor(request().headers, 'job:read')).rejects.toThrow('DSG_AUTH_REQUIRED');
  });
});
