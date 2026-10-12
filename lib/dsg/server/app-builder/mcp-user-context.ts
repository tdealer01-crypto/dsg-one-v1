import { createRemoteJWKSet, jwtVerify } from 'jose';
import { assertDsgPermission, type DsgServerActor } from '@/lib/dsg/server/context';
import { getDsgSupabaseRpcConfig, readDsgRest } from '@/lib/dsg/server/supabase-rpc';
import { DSG_AUTH0_AUDIENCE, DSG_AUTH0_CLIENT_ID, DSG_AUTH0_ISSUER } from '@/lib/dsg/server/auth0-identity';
import type { AppBuilderRequestContext } from './context';

// This read-only identity bridge deliberately does not accept internal service
// tokens, user-supplied principal headers, workspace-role headers, or cookies.
// It is not connected to the Spacetime adapter until signed end-user OAuth
// forwarding has been reviewed and verified across both MCP servers.
const jwks = createRemoteJWKSet(new URL('.well-known/jwks.json', DSG_AUTH0_ISSUER), {
  timeoutDuration: 5000,
});
const WORKSPACE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_MAX_LENGTH = 15_000;
type LinkRow = {
  actor_id: string;
  auth0_sub: string;
  auth0_issuer: string;
  auth0_client_id: string;
};
type MembershipRow = { role: DsgServerActor['role'] };

export class McpUserJobsDenied extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code);
  }
}

function serviceConfig() {
  const serverKey = process.env.DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY?.trim();
  const configuredUrl = process.env.DSG_ONE_V1_SUPABASE_URL?.trim();
  if (!serverKey || !configuredUrl || (serverKey.startsWith('sb_') && !serverKey.startsWith('sb_secret_'))) {
    throw new McpUserJobsDenied('DSG_MCP_JOBS_DB_NOT_CONFIGURED', 503);
  }
  const config = getDsgSupabaseRpcConfig();
  if (config.key !== serverKey || config.url !== configuredUrl.replace(/\/+$/, '')) {
    throw new McpUserJobsDenied('DSG_MCP_JOBS_DB_SCOPE_MISMATCH', 503);
  }
  return config;
}

export async function verifiedMcpAppBuilderReadContext(headers: Headers): Promise<AppBuilderRequestContext> {
  const expectedClient = process.env.DSG_SPACETIME_CHATGPT_CLIENT_ID?.trim();
  if (!expectedClient || !/^tpc_[A-Za-z0-9_-]{8,128}$/.test(expectedClient)) {
    throw new McpUserJobsDenied('DSG_MCP_OAUTH_CLIENT_NOT_CONFIGURED', 503);
  }

  const auth = headers.get('authorization');
  if (!auth?.startsWith('Bearer ') || auth.length > TOKEN_MAX_LENGTH + 7) {
    throw new McpUserJobsDenied('DSG_MCP_USER_OAUTH_REQUIRED', 401);
  }
  const token = auth.slice(7).trim();
  if (token.length < 100 || token.length > TOKEN_MAX_LENGTH) {
    throw new McpUserJobsDenied('DSG_MCP_USER_OAUTH_REQUIRED', 401);
  }

  // The requested workspace is an untrusted selector; membership is independently
  // resolved below against the server-side durable membership table.
  const workspaceId = headers.get('x-dsg-workspace-id')?.trim() ?? '';
  if (!WORKSPACE_UUID.test(workspaceId)) {
    throw new McpUserJobsDenied('DSG_MCP_WORKSPACE_SELECTION_REQUIRED', 400);
  }

  let subject = '';
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: DSG_AUTH0_ISSUER,
      audience: DSG_AUTH0_AUDIENCE,
      algorithms: ['RS256'],
      clockTolerance: 5,
    });
    if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 220 ||
        payload.azp !== expectedClient || !payload.exp || !payload.iat ||
        payload.iat > Date.now() / 1000 + 5 || typeof payload.scope !== 'string') {
      throw new Error('CLAIMS_REJECTED');
    }
    const scopes = payload.scope.split(/\s+/);
    if (!scopes.includes('dsg.use') || scopes.includes('dsg.approve')) {
      throw new Error('SCOPE_REJECTED');
    }
    subject = payload.sub;
  } catch {
    throw new McpUserJobsDenied('DSG_MCP_USER_OAUTH_INVALID', 401);
  }

  const config = serviceConfig();
  let links: LinkRow[];
  try {
    links = await readDsgRest<LinkRow[]>(config, 'dsg_auth0_identity_links', {
      auth0_sub: 'eq.' + subject,
      select: 'actor_id,auth0_sub,auth0_issuer,auth0_client_id',
      limit: '2',
    });
  } catch {
    throw new McpUserJobsDenied('DSG_MCP_IDENTITY_LINK_STORE_UNAVAILABLE', 503);
  }
  if (links.length !== 1 || links[0]?.auth0_sub !== subject ||
      links[0]?.auth0_issuer !== DSG_AUTH0_ISSUER ||
      links[0]?.auth0_client_id !== DSG_AUTH0_CLIENT_ID ||
      !links[0]?.actor_id) {
    throw new McpUserJobsDenied('DSG_MCP_USER_ACCOUNT_NOT_LINKED', 403);
  }

  const actorId = links[0].actor_id;
  let members: MembershipRow[];
  try {
    members = await readDsgRest<MembershipRow[]>(config, 'dsg_workspace_members', {
      workspace_id: 'eq.' + workspaceId,
      actor_id: 'eq.' + actorId,
      select: 'role',
      limit: '1',
    });
  } catch {
    throw new McpUserJobsDenied('DSG_MCP_WORKSPACE_STORE_UNAVAILABLE', 503);
  }
  const role = members[0]?.role;
  if (!role) throw new McpUserJobsDenied('DSG_MCP_WORKSPACE_ACCESS_DENIED', 403);
  try {
    assertDsgPermission({ actorId, workspaceId, role }, 'job:read');
  } catch {
    throw new McpUserJobsDenied('DSG_MCP_WORKSPACE_ACCESS_DENIED', 403);
  }
  return { actorId, workspaceId, actorRole: role, permission: 'job:read' };
}
