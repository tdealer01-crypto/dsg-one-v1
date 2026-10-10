import { NextResponse } from 'next/server';
import { resolveVerifiedDsgActor } from '@/lib/dsg/server/context';

// Read-only coordination surface. No provider execution and no credential substitution.
const AWS_MCP_RESOURCE = 'https://aws.dsg.pics';
const AWS_OAUTH_METADATA = `${AWS_MCP_RESOURCE}/.well-known/oauth-protected-resource`;
const AUTH0_ISSUER = 'https://dev-kcddqmnusbxxo25s.us.auth0.com/';
const DSG_ONE_STATUS = 'https://dsg.pics/api/agent/status';

type Probe = { state: 'REACHABLE' | 'NOT_VERIFIED'; http_status: number | null; reason: string };

async function checkMetadata(): Promise<Probe> {
  try {
    const response = await fetch(AWS_OAUTH_METADATA, {
      cache: 'no-store',
      redirect: 'error',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return { state: 'NOT_VERIFIED', http_status: response.status, reason: 'HTTP_ERROR' };
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object') {
      return { state: 'NOT_VERIFIED', http_status: response.status, reason: 'METADATA_INVALID' };
    }
    const metadata = body as { resource?: unknown; authorization_servers?: unknown };
    const issuers = metadata.authorization_servers;
    if (metadata.resource !== AWS_MCP_RESOURCE || !Array.isArray(issuers) || !issuers.includes(AUTH0_ISSUER)) {
      return { state: 'NOT_VERIFIED', http_status: response.status, reason: 'OAUTH_RESOURCE_MISMATCH' };
    }
    return { state: 'REACHABLE', http_status: response.status, reason: 'METADATA_MATCH' };
  } catch {
    return { state: 'NOT_VERIFIED', http_status: null, reason: 'NETWORK_ERROR' };
  }
}

async function checkDsgOne(): Promise<Probe> {
  try {
    const response = await fetch(DSG_ONE_STATUS, {
      cache: 'no-store',
      redirect: 'error',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return { state: 'NOT_VERIFIED', http_status: response.status, reason: 'HTTP_ERROR' };
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object') {
      return { state: 'NOT_VERIFIED', http_status: response.status, reason: 'STATUS_INVALID' };
    }
    const status = body as { ok?: unknown; deployment?: { sourceBound?: unknown; digestBound?: unknown } };
    const bound = status.ok === true && status.deployment?.sourceBound === true && status.deployment?.digestBound === true;
    return bound
      ? { state: 'REACHABLE', http_status: response.status, reason: 'APP_HEALTH_AND_IMAGE_BOUND' }
      : { state: 'NOT_VERIFIED', http_status: response.status, reason: 'DEPLOYMENT_IDENTITY_NOT_VERIFIED' };
  } catch {
    return { state: 'NOT_VERIFIED', http_status: null, reason: 'NETWORK_ERROR' };
  }
}

export async function GET(request: Request) {
  let actor;
  try {
    actor = await resolveVerifiedDsgActor(request.headers);
  } catch {
    return NextResponse.json({ ok: false, error: 'DSG_AUTH_REQUIRED' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!actor) {
    return NextResponse.json({ ok: false, error: 'DSG_AUTH_REQUIRED' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const [mcp, dsgOne] = await Promise.all([checkMetadata(), checkDsgOne()]);
  return NextResponse.json({
    ok: true,  // Authenticated status read only. NOT an execution or connector OAuth verdict.
    workspace: { id: actor.workspaceId, role: actor.role },
    authority: 'AWS_SPACETIME',
    execution_path: ['goal_proposal', 'spacetime_discover', 'spacetime_compose', 'policy_gate', 'approval_if_required', 'spacetime_execute', 'spacetime_verify_evidence', 'provider_postcondition'],
    surfaces: {
      workroom: { state: 'VERIFIED_SITE_SESSION', path: '/dsg/workroom', principal_bound_to_spacetime: false },
      goal_first_lab: { state: 'EXTERNAL_APP_SESSION_NOT_VERIFIED', role: 'proposal_and_local_skills', principal_bound_to_spacetime: false },
      execution_evidence: { state: 'EXTERNAL_APP_SESSION_NOT_VERIFIED', role: 'read_only_diagnostics', principal_bound_to_spacetime: false },
      spacetime: { state: mcp.state, metadata: mcp, authenticated_user_mcp: 'NOT_VERIFIED' },
      dsg_one: { state: dsgOne.state, health: dsgOne },
      chatgpt_mobile_custom_mcp: { state: 'HOST_SUPPORT_NOT_VERIFIED' },
    },
    user_oauth_e2e: 'NOT_VERIFIED',
    provider_execution_e2e: 'NOT_VERIFIED',
    owner_service_credential_substitution: 'FORBIDDEN',
  }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}
