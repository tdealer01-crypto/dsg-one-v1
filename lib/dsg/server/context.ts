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
  | 'production:write';

const permissionsByRole: Record<DsgServerActor['role'], DsgPermission[]> = {
  OWNER: ['job:read', 'job:create', 'job:plan', 'job:control', 'approval:write', 'evidence:write', 'audit:export', 'replay:verify', 'deployment:write', 'production:write'],
  ADMIN: ['job:read', 'job:create', 'job:plan', 'job:control', 'approval:write', 'evidence:write', 'audit:export', 'replay:verify', 'deployment:write'],
  OPERATOR: ['job:read', 'job:create', 'job:plan', 'job:control', 'approval:write', 'evidence:write', 'replay:verify'],
  AUDITOR: ['job:read', 'audit:export', 'replay:verify'],
  VIEWER: ['job:read'],
};

export function assertDsgPermission(actor: DsgServerActor | null, permission: DsgPermission): DsgServerActor {
  if (!actor) throw new Error('DSG_AUTH_REQUIRED');
  if (!actor.actorId || !actor.workspaceId) throw new Error('DSG_CONTEXT_REQUIRED');
  if (!permissionsByRole[actor.role]?.includes(permission)) throw new Error('DSG_PERMISSION_DENIED');
  return actor;
}

export function devHeaderActor(headers: Headers): DsgServerActor | null {
  const actorId = headers.get('x-dsg-actor-id');
  const workspaceId = headers.get('x-dsg-workspace-id');
  const role = headers.get('x-dsg-actor-role') as DsgServerActor['role'] | null;
  if (!actorId || !workspaceId || !role) return null;
  if (!Object.prototype.hasOwnProperty.call(permissionsByRole, role)) return null;
  return { actorId, workspaceId, role };
}
