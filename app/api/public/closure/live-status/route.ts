import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Fixed-origin anonymous read-only probes only. This endpoint never receives
// an Auth0 token, executes MCP tools, or promotes software emulation to Quest proof.
const STATUS_URL = 'https://dsg.pics/api/agent/status';
const META_URL = 'https://aws.dsg.pics/.well-known/oauth-protected-resource';
const MCP_URL = 'https://aws.dsg.pics/mcp';
const EXPECTED_RESOURCE = 'https://aws.dsg.pics';
const EXPECTED_ISSUER = 'https://dev-kcddqmnusbxxo25s.us.auth0.com/';
const HEX_SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;

type Check = {
  id: string;
  label: string;
  state: 'VERIFIED' | 'REACHABLE' | 'HISTORICAL_VERIFIED' | 'NOT_VERIFIED';
  detail: string;
  source: string;
};

async function probeStatus(): Promise<Check> {
  const source = STATUS_URL;
  try {
    const response = await fetch(source, {
      cache: 'no-store',
      redirect: 'error',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6500),
    });
    if (!response.ok) throw new Error('STATUS_HTTP_ERROR');
    const raw: unknown = await response.json();
    const body = raw && typeof raw === 'object' && !Array.isArray(raw)
      ? raw as Record<string, unknown> : null;
    const deployment = body?.deployment && typeof body.deployment === 'object' && !Array.isArray(body.deployment)
      ? body.deployment as Record<string, unknown> : null;
    const valid = body?.ok === true && body?.env === 'production' &&
      deployment?.sourceBound === true && deployment?.digestBound === true &&
      typeof body?.version === 'string' && HEX_SHA.test(body.version) &&
      typeof deployment.imageDigest === 'string' && DIGEST.test(deployment.imageDigest) &&
      deployment.buildSourceSha === body.version && deployment.expectedSourceSha === body.version;
    return {
      id: 'website-runtime',
      label: 'DSG ONE production website',
      state: valid ? 'VERIFIED' : 'NOT_VERIFIED',
      detail: valid ? 'Live production health and exact source/digest binding verified' : 'Missing or invalid live source/digest/health receipt',
      source,
    };
  } catch {
    return { id: 'website-runtime', label: 'DSG ONE production website', state: 'NOT_VERIFIED',
      detail: 'Live website health proof unavailable; no PASS inferred', source };
  }
}

async function probeMetadata(): Promise<Check> {
  try {
    const response = await fetch(META_URL, {
      cache: 'no-store',
      redirect: 'error',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6500),
    });
    if (!response.ok) throw new Error('METADATA_HTTP_ERROR');
    const raw: unknown = await response.json();
    const body = raw && typeof raw === 'object' && !Array.isArray(raw)
      ? raw as Record<string, unknown> : null;
    const valid = body?.resource === EXPECTED_RESOURCE &&
      Array.isArray(body?.authorization_servers) &&
      body.authorization_servers.includes(EXPECTED_ISSUER);
    return {
      id: 'auth0-metadata', label: 'AWS Auth0 protected-resource metadata',
      state: valid ? 'REACHABLE' : 'NOT_VERIFIED',
      detail: valid ? 'Resource and issuer match; this does NOT prove a user OAuth token or E2E execution' : 'Resource/issuer proof unavailable or mismatched',
      source: META_URL,
    };
  } catch {
    return { id: 'auth0-metadata', label: 'AWS Auth0 protected-resource metadata', state: 'NOT_VERIFIED',
      detail: 'OAuth resource metadata could not be independently read', source: META_URL };
  }
}

async function probeAnonymousMcp(): Promise<Check> {
  try {
    const response = await fetch(MCP_URL, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'error',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6500),
    });
    // 401 is the correct anonymous-denial receipt, NOT an authenticated E2E PASS.
    const valid = response.status === 401;
    await response.body?.cancel().catch(() => undefined);
    return { id: 'anonymous-mcp', label: 'Anonymous MCP access control',
      state: valid ? 'VERIFIED' : 'NOT_VERIFIED',
      detail: valid ? 'Anonymous GET rejected with HTTP 401 (fail closed); signed-in user flow still not verified' : 'Expected HTTP 401 denial was not observed',
      source: MCP_URL };
  } catch {
    return { id: 'anonymous-mcp', label: 'Anonymous MCP access control', state: 'NOT_VERIFIED',
      detail: 'Anonymous-denial response could not be obtained', source: MCP_URL };
  }
}

export async function GET() {
  const [website, metadata, anonymous] = await Promise.all([
    probeStatus(), probeMetadata(), probeAnonymousMcp(),
  ]);
  const checks: Check[] = [
    website,
    metadata,
    anonymous,
    {
      id: 'unity-build-14',
      label: 'Unity Build Automation #14 — artifact attestation',
      state: 'HISTORICAL_VERIFIED',
      detail: 'Previously verified APK + exact source/evidence bundle; historical build proof only, not Unity Editor or Quest runtime E2E',
      source: 'https://github.com/tdealer01-crypto/dsg-meta-xr-client/actions/runs/36953067672',
    },
    {
      id: 'unity-runtime',
      label: 'Unity Editor / XR governed runtime E2E',
      state: 'NOT_VERIFIED',
      detail: 'Requires new Unity/XR-originated intent, exact provider receipt, plan/request/evidence hashes and verified postcondition',
      source: 'https://github.com/tdealer01-crypto/dsg-meta-xr-client',
    },
    {
      id: 'quest-hands',
      label: 'Meta Quest hands-first on-device E2E',
      state: 'NOT_VERIFIED',
      detail: 'Physical Quest device or qualifying real XR runtime evidence with head + both hands, exact APK and governed world commit required; phone simulator does not qualify',
      source: 'https://github.com/tdealer01-crypto/dsg-meta-xr-client',
    },
    {
      id: 'user-oauth',
      label: 'User-bound Auth0 → AWS provider read E2E',
      state: 'NOT_VERIFIED',
      detail: 'Requires a user-initiated signed-in session and fresh provider receipt with route, plan hash, evidence hash and verified chain; anonymous probes cannot satisfy this',
      source: 'https://dsg.pics/dsg/autonomous-level',
    },
  ];
  return NextResponse.json({
    ok: true,
    schema: 'dsg-public-closure-evidence/v1',
    observed_at: new Date().toISOString(),
    authority: 'AWS_ONLY',
    overall_e2e: 'NOT_VERIFIED',
    check_type: 'LIVE_PUBLIC_READ_ONLY_PROBES_PLUS_HISTORICAL_SOURCE_CLASSIFICATION',
    checks,
    oauth_user_action: '/dsg/autonomous-level',
    warnings: [
      'Public health, metadata and HTTP 401 cannot certify signed-in provider execution.',
      'Historical Unity Build #14 evidence is not a current XR runtime PASS.',
      'Quest hands-first proof requires real supported Quest input; never accept software surrogate.',
      'This API does not expose private artifacts, secrets or actor-specific receipts.',
    ],
  }, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
