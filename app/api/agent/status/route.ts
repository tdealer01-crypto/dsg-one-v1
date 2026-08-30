import { NextResponse } from 'next/server';

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;

type DatabaseCheck =
  | { ok: true; status: number }
  | { ok: false; status: number | null; reason: 'NOT_CONFIGURED' | 'UNREACHABLE' | 'HTTP_ERROR' };

async function checkDatabase(): Promise<DatabaseCheck> {
  const baseUrl = process.env.DSG_ONE_V1_SUPABASE_URL?.trim().replace(/\/+$/, '');
  const serviceRoleKey = process.env.DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!baseUrl || !serviceRoleKey) {
    return { ok: false, status: null, reason: 'NOT_CONFIGURED' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(`${baseUrl}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
      },
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, status: response.status, reason: 'HTTP_ERROR' };
    }

    return { ok: true, status: response.status };
  } catch {
    return { ok: false, status: null, reason: 'UNREACHABLE' };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  const buildSourceSha = process.env.DSG_BUILD_SOURCE_SHA?.trim() || null;
  const expectedSourceSha = process.env.DSG_DEPLOYED_SOURCE_SHA?.trim() || null;
  const imageDigest = process.env.DSG_DEPLOYED_IMAGE_DIGEST?.trim() || null;
  const isAzure = Boolean(process.env.WEBSITE_SITE_NAME);

  const sourceBound = Boolean(
    buildSourceSha
      && expectedSourceSha
      && SHA_PATTERN.test(buildSourceSha)
      && SHA_PATTERN.test(expectedSourceSha)
      && buildSourceSha === expectedSourceSha,
  );
  const digestBound = Boolean(imageDigest && DIGEST_PATTERN.test(imageDigest));
  const deploymentIdentityOk = isAzure ? sourceBound && digestBound : true;
  const database = await checkDatabase();
  const ok = deploymentIdentityOk && database.ok;

  return NextResponse.json(
    {
      ok,
      repo: 'dsg-one-v1',
      version: buildSourceSha ?? 'local',
      env: isAzure ? 'azure-app-service' : (process.env.NODE_ENV ?? 'local'),
      ts: new Date().toISOString(),
      deployment: {
        buildSourceSha,
        expectedSourceSha,
        imageDigest,
        sourceBound,
        digestBound,
      },
      checks: {
        process: true,
        db: database.ok,
      },
      readiness: {
        database,
        deploymentIdentityOk,
      },
    },
    { status: ok ? 200 : 503 },
  );
}
