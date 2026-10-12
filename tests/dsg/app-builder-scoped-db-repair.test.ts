import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { supabaseRest } from '../../lib/dsg/server/app-builder/supabase-rest';
import { classifyAppBuilderJobError } from '../../lib/dsg/server/app-builder/job-error';

const endpoint = 'https://scoped-example.supabase.co';
const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function scopedEnv(key = 'sb_secret_test_server_only') {
  vi.stubEnv('DSG_ONE_V1_SUPABASE_URL', endpoint);
  vi.stubEnv('DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY', key);
}

describe('App Builder persisted jobs: scoped DB repair contract', () => {
  it('does not silently use generic Supabase configuration from another project', async () => {
    vi.stubEnv('DSG_ONE_V1_SUPABASE_URL', '');
    vi.stubEnv('DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY', '');
    vi.stubEnv('SUPABASE_URL', 'https://wrong-project.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'legacy-wrong-project');

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('[]'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(supabaseRest({ path: 'dsg_app_builder_jobs' })).rejects.toThrow('APP_BUILDER_DB_URL_NOT_CONFIGURED');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires a server-only service role even when a public key is configured', async () => {
    vi.stubEnv('DSG_ONE_V1_SUPABASE_URL', endpoint);
    vi.stubEnv('DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_DSG_ONE_V1_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_public');
    await expect(supabaseRest({ path: 'dsg_app_builder_jobs' })).rejects.toThrow('APP_BUILDER_DB_SERVICE_ROLE_NOT_CONFIGURED');
    scopedEnv('sb_publishable_never_admin');
    await expect(supabaseRest({ path: 'dsg_app_builder_jobs' })).rejects.toThrow('APP_BUILDER_DB_SERVICE_ROLE_INVALID');
  });

  it('uses repo-scoped secret key on apikey only and preserves server-side workspace filter', async () => {
    scopedEnv();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const data = await supabaseRest<unknown[]>({ path: 'dsg_app_builder_jobs', query: '?workspace_id=eq.workspace-1&limit=8' });

    expect(data).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe(endpoint + '/rest/v1/dsg_app_builder_jobs?workspace_id=eq.workspace-1&limit=8');
    expect(options?.method).toBe('GET');
    expect(options?.cache).toBe('no-store');
    expect(options?.headers).toMatchObject({ apikey: 'sb_secret_test_server_only', 'content-type': 'application/json' });
    expect((options?.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it('retains JWT bearer authentication for legacy service_role configurations', async () => {
    scopedEnv('legacy-jwt-service-role');
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await supabaseRest({ method: 'POST', path: 'dsg_app_builder_jobs', body: { workspace_id: 'workspace-1' } });
    const [, options] = fetchMock.mock.calls[0]!;
    expect(options?.headers).toMatchObject({ apikey: 'legacy-jwt-service-role', authorization: 'Bearer legacy-jwt-service-role' });
    expect(options?.body).toBe(JSON.stringify({ workspace_id: 'workspace-1' }));
  });

  it.each([
    [401, 'APP_BUILDER_DB_ACCESS_DENIED'],
    [403, 'APP_BUILDER_DB_ACCESS_DENIED'],
    [404, 'APP_BUILDER_DB_SCHEMA_OR_ROUTE_NOT_FOUND'],
    [500, 'APP_BUILDER_DB_UPSTREAM_UNAVAILABLE'],
    [400, 'APP_BUILDER_DB_REQUEST_REJECTED'],
  ])('maps upstream HTTP %i to a bounded error without leaking provider text', async (status, expected) => {
    scopedEnv();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('private: relation "sensitive_table" not found', { status })));
    await expect(supabaseRest({ path: 'dsg_app_builder_jobs' })).rejects.toThrow(expected);
  });

  it('bounds transport failure and invalid response bodies', async () => {
    scopedEnv();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('connection with private address'); }));
    await expect(supabaseRest({ path: 'dsg_app_builder_jobs' })).rejects.toThrow('APP_BUILDER_DB_CONNECT_FAILED');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not-json', { status: 200 })));
    await expect(supabaseRest({ path: 'dsg_app_builder_jobs' })).rejects.toThrow('APP_BUILDER_DB_RESPONSE_INVALID');
  });

  it('returns only allowlisted API errors with correct auth and database statuses', () => {
    expect(classifyAppBuilderJobError(new Error('DSG_AUTH_REQUIRED'))).toEqual({ code: 'DSG_AUTH_REQUIRED', status: 401 });
    expect(classifyAppBuilderJobError(new Error('DSG_PERMISSION_DENIED'))).toEqual({ code: 'DSG_PERMISSION_DENIED', status: 403 });
    expect(classifyAppBuilderJobError(new Error('APP_BUILDER_JOB_NOT_FOUND'))).toEqual({ code: 'APP_BUILDER_JOB_NOT_FOUND', status: 404 });
    expect(classifyAppBuilderJobError(new Error('APP_BUILDER_DB_CONNECT_FAILED'))).toEqual({ code: 'APP_BUILDER_DB_CONNECT_FAILED', status: 503 });
    expect(classifyAppBuilderJobError(new Error('relation "customer_data" does not exist'))).toEqual({
      code: 'APP_BUILDER_REQUEST_FAILED', status: 500,
    });
  });

  it('keeps workspace identity checks and safe error mapping on list and detail routes', () => {
    const list = source('app/api/dsg/app-builder/jobs/route.ts');
    const detail = source('app/api/dsg/app-builder/jobs/[jobId]/route.ts');
    const repo = source('lib/dsg/server/app-builder/repository.ts');
    const ui = source('components/dsg/app-builder/AppBuilderConsoleClient.tsx');

    expect(list).toContain("getAppBuilderRequestContext(req, 'job:read')");
    expect(detail).toContain("getAppBuilderRequestContext(req, 'job:read')");
    expect(list).toContain('classifyAppBuilderJobError(error)');
    expect(detail).toContain('classifyAppBuilderJobError(error)');
    expect(list).toContain('private, no-store');
    expect(detail).toContain('private, no-store');
    expect(repo).toContain('workspace_id=eq.');
    expect(ui).toContain('APP_BUILDER_DB_URL_NOT_CONFIGURED');
    expect(ui).toContain('WORKSPACE_ACCESS_DENIED');
    expect(ui).not.toContain("localStorage.getItem(");
  });
});
