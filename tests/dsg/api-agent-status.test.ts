import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET } from '../../app/api/agent/status/route';

function configureDatabase() {
  vi.stubEnv('DSG_ONE_V1_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })));
}

describe('GET /api/agent/status', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('returns 200 only after a real database check succeeds', async () => {
    configureDatabase();

    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      ok: true,
      repo: 'dsg-one-v1',
      version: 'local',
      checks: { process: true, db: true },
      readiness: {
        database: { ok: true, status: 200 },
        deploymentIdentityOk: true,
      },
    });
    expect(typeof body.env).toBe('string');
    expect(typeof body.ts).toBe('string');
  });

  it('fails closed when database configuration is absent', async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.version).toBe('local');
    expect(body.checks.db).toBe(false);
    expect(body.readiness.database).toEqual({
      ok: false,
      status: null,
      reason: 'NOT_CONFIGURED',
    });
  });

  it('uses NODE_ENV outside Azure instead of legacy Vercel variables', async () => {
    configureDatabase();
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc123');

    const response = await GET();
    const body = await response.json();

    expect(body.env).toBe(process.env.NODE_ENV ?? 'local');
    expect(body.version).toBe('local');
  });

  it('returns a valid ISO 8601 observation timestamp', async () => {
    configureDatabase();

    const response = await GET();
    const body = await response.json();

    expect(Number.isNaN(new Date(body.ts).getTime())).toBe(false);
  });

  it('returns a consistent repo name regardless of runtime configuration', async () => {
    configureDatabase();
    vi.stubEnv('WEBSITE_SITE_NAME', '');

    const response = await GET();
    const body = await response.json();

    expect(body.repo).toBe('dsg-one-v1');
  });
});
