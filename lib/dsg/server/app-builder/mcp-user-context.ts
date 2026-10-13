import { createHash } from 'node:crypto';
import { importJWK, jwtVerify } from 'jose';
import { assertDsgPermission, type DsgServerActor } from '@/lib/dsg/server/context';
import { callDsgRpc, getDsgSupabaseRpcConfig, readDsgRest } from '@/lib/dsg/server/supabase-rpc';
import { DSG_AUTH0_CLIENT_ID, DSG_AUTH0_ISSUER } from '@/lib/dsg/server/auth0-identity';
import type { AppBuilderRequestContext } from './context';

// This downstream resource accepts ONLY a purpose-bound signed Spacetime delegation
// assertion (Ed25519/EdDSA), NOT the Auth0 Bearer intended for aws.dsg.pics.
// The Spacetime signer must first verify the real Auth0 user and the governed
// route/plan decision. Public verification key must be pinned out of band.
const DELEGATION_ISSUER = 'urn:dsg:spacetime:jobs-delegation';
const DELEGATION_AUDIENCE = 'https://dsg.pics/api/dsg/app-builder/jobs/oauth';
const DELEGATED_ROUTE = 'route.dsg-one-v1.mcp.list-app-builder-jobs';
const HASH_SHA256 = /^[0-9a-f]{64}$/;
const DELEGATION_MAX_SECONDS = 30;
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
  if (!auth?.toLowerCase().startsWith('bearer ') || auth.length > TOKEN_MAX_LENGTH + 7) {
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

  // No ChatGPT/AWS-audience OAuth token is usable as a downstream website bearer.
  // The signer-specific public key is mandatory and is never supplied by the caller.
  const publicKeyB64 = process.env.DSG_SPACETIME_JOBS_DELEGATION_PUBLIC_KEY_B64?.trim();
  if (!publicKeyB64 || !/^[A-Za-z0-9+/]{43}=$/.test(publicKeyB64)) {
    throw new McpUserJobsDenied('DSG_MCP_DELEGATION_KEY_NOT_CONFIGURED', 503);
  }

  let subject = '';
  let receiptHash = '';
  let expiresAt = 0;
  try {
    const rawKey = Buffer.from(publicKeyB64, 'base64');
    if (rawKey.length !== 32 || rawKey.toString('base64') !== publicKeyB64) throw new Error('PIN_INVALID');
    const publicKey = await importJWK({
      kty: 'OKP', crv: 'Ed25519', x: rawKey.toString('base64url'),
    }, 'EdDSA');
    const { payload } = await jwtVerify(token, publicKey, {
      issuer: DELEGATION_ISSUER,
      audience: DELEGATION_AUDIENCE,
      algorithms: ['EdDSA'],
      clockTolerance: 2,
    });
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 220 ||
        payload.iss !== DELEGATION_ISSUER || payload.aud !== DELEGATION_AUDIENCE ||
        payload.azp !== expectedClient || payload.auth0_iss !== DSG_AUTH0_ISSUER ||
        payload.scope !== 'dsg.jobs.read' || payload.route_id !== DELEGATED_ROUTE ||
        payload.workspace_id !== workspaceId || payload.verdict !== 'ALLOW' ||
        typeof payload.plan_id !== 'string' || !payload.plan_id || payload.plan_id.length > 192 ||
        typeof payload.plan_hash !== 'string' || !HASH_SHA256.test(payload.plan_hash) ||
        typeof payload.decision_hash !== 'string' || !HASH_SHA256.test(payload.decision_hash) ||
        typeof payload.jti !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(payload.jti) ||
        !Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.nbf) ||
        !Number.isSafeInteger(payload.exp) ||
        typeof payload.iat !== 'number' || typeof payload.nbf !== 'number' ||
        typeof payload.exp !== 'number' || payload.nbf < payload.iat ||
        payload.exp <= payload.nbf || payload.exp <= payload.iat ||
        payload.iat > now + 2 || now - payload.iat > DELEGATION_MAX_SECONDS ||
        payload.exp <= now || payload.exp - payload.iat > DELEGATION_MAX_SECONDS) {
      throw new Error('DELEGATION_CLAIMS_REJECTED');
    }
    subject = payload.sub;
    receiptHash = createHash('sha256').update(JSON.stringify([DELEGATION_ISSUER, payload.jti])).digest('hex');
    expiresAt = payload.exp;
  } catch {
    throw new McpUserJobsDenied('DSG_MCP_DELEGATION_INVALID', 401);
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

  // Consume only after signature, linked identity and permission checks. The
  // durable DB unique key arbitrates across processes/replicas, not local memory.
  // Never retry an uncertain consume: it may already have committed. A failed
  // Jobs read also leaves the receipt spent; a fresh governed execution is needed.
  let consumed: unknown;
  try {
    consumed = await callDsgRpc<unknown>(config, 'consume_dsg_jobs_delegation', {
      p_receipt_sha256: receiptHash,
      p_expires_at: expiresAt,
    });
  } catch {
    throw new McpUserJobsDenied('DSG_MCP_REPLAY_STORE_UNAVAILABLE', 503);
  }
  if (consumed === false) throw new McpUserJobsDenied('DSG_MCP_DELEGATION_REPLAYED', 409);
  if (consumed !== true) throw new McpUserJobsDenied('DSG_MCP_REPLAY_STORE_UNAVAILABLE', 503);
  return { actorId, workspaceId, actorRole: role, permission: 'job:read' };
}
