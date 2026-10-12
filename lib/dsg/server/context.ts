import { getBearerToken, getDsgSupabaseRpcConfig, readDsgRest } from './supabase-rpc';

export type DsgServerActor = {
  actorId: string;
  workspaceId: string;
  role: 'OWNER' | 'ADMIN' | 'OPERATOR' | 'AUDITOR' | 'VIEWER';
};

export type DsgPermission =
  | 'job:read'
  | 'job:create'
  | 'job:plan'
  | 'job:control'
  | 'approval:write'
  | 'evidence:write'
  | 'audit:export'
  | 'replay:verify'
  | 'deployment:write'
  | 'production:write'
  | 'skill:read'
  | 'skill:execute'
  | 'read:generated-apps'
  | 'write:generated-apps';

const permissionsByRole: Record<DsgServerActor['role'], DsgPermission[]> = {
  OWNER: ['job:read', 'job:create', 'job:plan', 'job:control', 'approval:write', 'evidence:write', 'audit:export', 'replay:verify', 'deployment:write', 'production:write', 'skill:read', 'skill:execute', 'read:generated-apps', 'write:generated-apps'],
  ADMIN: ['job:read', 'job:create', 'job:plan', 'job:control', 'approval:write', 'evidence:write', 'audit:export', 'replay:verify', 'deployment:write', 'skill:read', 'skill:execute', 'read:generated-apps', 'write:generated-apps'],
  OPERATOR: ['job:read', 'job:create', 'job:plan', 'job:control', 'approval:write', 'evidence:write', 'replay:verify', 'skill:read', 'skill:execute', 'read:generated-apps', 'write:generated-apps'],
  AUDITOR: ['job:read', 'audit:export', 'replay:verify', 'skill:read', 'read:generated-apps'],
  VIEWER: ['job:read', 'skill:read', 'read:generated-apps'],
};

export function assertDsgPermission(actor: DsgServerActor | null, permission: DsgPermission): DsgServerActor {
  if (!actor) throw new Error('DSG_AUTH_REQUIRED');
  if (!actor.actorId || !actor.workspaceId) throw new Error('DSG_CONTEXT_REQUIRED');
  if (!permissionsByRole[actor.role]?.includes(permission)) throw new Error('DSG_PERMISSION_DENIED');
  return actor;
}

type SupabaseUserResponse = { id?: string; sub?: string; email?: string };

export type VerifiedDsgUser = { id: string; email: string | null };
type WorkspaceMemberRow = { role: DsgServerActor['role'] };

function getCookieValue(headers: Headers, name: string): string | undefined {
  const raw = headers.get('cookie');
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key !== name) continue;
    const value = rest.join('=');
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return undefined;
}

export function getDsgUserAccessToken(headers: Headers): string | undefined {
  return getBearerToken(headers) ?? getCookieValue(headers, 'sb-access-token');
}

// The token is only trusted after the auth server has accepted it.
async function fetchVerifiedUser(userAccessToken: string): Promise<VerifiedDsgUser | null> {
  const config = getDsgSupabaseRpcConfig(userAccessToken);
  const userResponse = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${userAccessToken}`,
    },
    cache: 'no-store',
  });

  if (!userResponse.ok) return null;
  const user = (await userResponse.json()) as SupabaseUserResponse;
  const id = user.id ?? user.sub;
  if (!id) return null;
  return { id, email: typeof user.email === 'string' && user.email.trim() ? user.email.trim().toLowerCase() : null };
}

// Identity only (no workspace): for actions that belong to the person, not to a workspace.
export async function resolveVerifiedDsgUser(headers: Headers): Promise<VerifiedDsgUser | null> {
  const userAccessToken = getDsgUserAccessToken(headers);
  if (!userAccessToken) return null;
  return fetchVerifiedUser(userAccessToken);
}

export async function resolveVerifiedDsgActor(headers: Headers): Promise<DsgServerActor | null> {
  const userAccessToken = getDsgUserAccessToken(headers);
  const workspaceId = headers.get('x-dsg-workspace-id') ?? getCookieValue(headers, 'dsg-workspace-id');
  if (!userAccessToken || !workspaceId) return null;

  const verified = await fetchVerifiedUser(userAccessToken);
  if (!verified) return null;
  const actorId = verified.id;

  const rows = await readDsgRest<WorkspaceMemberRow[]>(getDsgSupabaseRpcConfig(), 'dsg_workspace_members', {
    workspace_id: `eq.${workspaceId}`,
    actor_id: `eq.${actorId}`,
    select: 'role',
    limit: '1',
  });
  const role = rows[0]?.role;
  if (!role || !Object.prototype.hasOwnProperty.call(permissionsByRole, role)) return null;

  return { actorId, workspaceId, role };
}

export async function requireVerifiedDsgActor(headers: Headers, permission: DsgPermission): Promise<DsgServerActor> {
  return assertDsgPermission(await resolveVerifiedDsgActor(headers), permission);
}

export function devHeaderActor(headers: Headers): DsgServerActor | null {
  if (process.env.DSG_ALLOW_DEV_HEADER_ACTOR !== 'true') return null;
  const actorId = headers.get('x-dsg-actor-id');
  const workspaceId = headers.get('x-dsg-workspace-id');
  const role = headers.get('x-dsg-actor-role') as DsgServerActor['role'] | null;
  if (!actorId || !workspaceId || !role) return null;
  if (!Object.prototype.hasOwnProperty.call(permissionsByRole, role)) return null;
  return { actorId, workspaceId, role };
}
