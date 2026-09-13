import { NextResponse } from 'next/server';

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;

type DatabaseCheck =
  | { ok: true; status: number }
  | { ok: false; status: number | null; reason: 'NOT_CONFIGURED' | 'UNREACHABLE' | 'HTTP_ERROR'; diagnostic?: string };

function networkDiagnostic(error: unknown): string {
  if (!(error instanceof Error)) return 'UNKNOWN';
  const cause = (error as Error & { cause?: { code?: unknown } }).cause;
  const code = cause && typeof cause.code === 'string' ? cause.code : null;
  return code ? `${error.name}:${code}` : error.name;
}

function supabaseRequestHeaders(serverKey: string, acceptJson = false, profile?: string): Record<string, string> {
  const headers: Record<string, string> = { apikey: serverKey };
  if (!serverKey.startsWith('sb_')) {
    headers.authorization = `Bearer ${serverKey}`;
  }
  if (acceptJson) headers.Accept = 'application/json';
  if (profile) headers['Accept-Profile'] = profile;
  return headers;
}

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
      headers: supabaseRequestHeaders(serviceRoleKey),
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, status: response.status, reason: 'HTTP_ERROR' };
    }

    return { ok: true, status: response.status };
  } catch (error) {
    return { ok: false, status: null, reason: 'UNREACHABLE', diagnostic: networkDiagnostic(error) };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkAutomationSchema(): Promise<DatabaseCheck> {
  const baseUrl = process.env.DSG_ONE_V1_SUPABASE_URL?.trim().replace(/\/+$/, '');
  const serviceRoleKey = process.env.DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!baseUrl || !serviceRoleKey) {
    return { ok: false, status: null, reason: 'NOT_CONFIGURED' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(`${baseUrl}/rest/v1/dsg_automation_runs?select=id&limit=1`, {
      headers: supabaseRequestHeaders(serviceRoleKey, true, 'public'),
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) {
      return { ok: false, status: response.status, reason: 'HTTP_ERROR' };
    }
    return { ok: true, status: response.status };
  } catch (error) {
    return { ok: false, status: null, reason: 'UNREACHABLE', diagnostic: networkDiagnostic(error) };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  const buildSourceSha = process.env.DSG_BUILD_SOURCE_SHA?.trim() || null;
  const expectedSourceSha = process.env.DSG_DEPLOYED_SOURCE_SHA?.trim() || null;
  const imageDigest = process.env.DSG_DEPLOYED_IMAGE_DIGEST?.trim() || null;
  const isAzure = Boolean(process.env.WEBSITE_SITE_NAME);
  const automationEngineVersion = process.env.DSG_AUTOMATION_ENGINE_VERSION?.trim() || null;
  const automationEngineOk = automationEngineVersion === '1.18.0';

  const sourceBound = Boolean(
    buildSourceSha
      && expectedSourceSha
      && SHA_PATTERN.test(buildSourceSha)
      && SHA_PATTERN.test(expectedSourceSha)
      && buildSourceSha === expectedSourceSha,
  );
  const digestBound = Boolean(imageDigest && DIGEST_PATTERN.test(imageDigest));
  const deploymentIdentityOk = isAzure ? sourceBound && digestBound : true;
  const [database, automationDatabase] = await Promise.all([checkDatabase(), checkAutomationSchema()]);
  const ok = deploymentIdentityOk && database.ok && automationDatabase.ok && (!isAzure || automationEngineOk);

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
        automationDb: automationDatabase.ok,
        automationEngine: automationEngineOk,
      },
      readiness: {
        database,
        automationDatabase,
        deploymentIdentityOk,
        automationEngine: {
          ok: automationEngineOk,
          engine: 'microsoft-agent-framework',
          version: automationEngineVersion,
        },
      },
    },
    { status: ok ? 200 : 503 },
  );
}
