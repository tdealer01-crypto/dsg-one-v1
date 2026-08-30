import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../../app/api/agent/status/route';

const SOURCE_SHA = 'a'.repeat(40);
const OTHER_SHA = 'b'.repeat(40);
const IMAGE_DIGEST = `sha256:${'c'.repeat(64)}`;

function configureAzureIdentity(sourceSha = SOURCE_SHA) {
  vi.stubEnv('WEBSITE_SITE_NAME', 'dsg-one-v1');
  vi.stubEnv('DSG_BUILD_SOURCE_SHA', sourceSha);
  vi.stubEnv('DSG_DEPLOYED_SOURCE_SHA', SOURCE_SHA);
  vi.stubEnv('DSG_DEPLOYED_IMAGE_DIGEST', IMAGE_DIGEST);
  vi.stubEnv('DSG_ONE_V1_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('GET /api/agent/status', () => {
  it('returns readiness only when DB and exact deployment identity are verified', async () => {
    configureAzureIdentity();
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      version: SOURCE_SHA,
      env: 'azure-app-service',
      deployment: {
        buildSourceSha: SOURCE_SHA,
        expectedSourceSha: SOURCE_SHA,
        imageDigest: IMAGE_DIGEST,
        sourceBound: true,
        digestBound: true,
      },
      checks: { process: true, db: true },
      readiness: {
        deploymentIdentityOk: true,
        database: { ok: true, status: 200 },
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.supabase.co/rest/v1/',
      expect.objectContaining({ method: 'HEAD', cache: 'no-store' }),
    );
  });

  it('fails closed when the running build does not match the approved source SHA', async () => {
    configureAzureIdentity(OTHER_SHA);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.checks.db).toBe(true);
    expect(body.deployment.sourceBound).toBe(false);
    expect(body.readiness.deploymentIdentityOk).toBe(false);
  });

  it('fails closed when the database cannot be reached', async () => {
    configureAzureIdentity();
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('unreachable');
    }));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.deployment.sourceBound).toBe(true);
    expect(body.checks.db).toBe(false);
    expect(body.readiness.database).toEqual({
      ok: false,
      status: null,
      reason: 'UNREACHABLE',
    });
  });
});
