import { requireVerifiedDsgActor, type DsgPermission, type DsgServerActor } from '@/lib/dsg/server/context';

export type AppBuilderRequestContext = {
  workspaceId: string;
  actorId: string;
  actorRole: DsgServerActor['role'];
  permission: DsgPermission;
};

const AUTHORIZATION_CODES = new Set(['DSG_AUTH_REQUIRED', 'DSG_CONTEXT_REQUIRED', 'DSG_PERMISSION_DENIED']);

export async function getAppBuilderRequestContext(
  req: Request,
  permission: DsgPermission,
): Promise<AppBuilderRequestContext> {
  let actor: DsgServerActor;
  try {
    actor = await requireVerifiedDsgActor(req.headers, permission);
  } catch (error) {
    // Known authorization outcomes pass through. Anything else comes from the verification backend (token check,
    // membership read, env configuration) and can carry PostgREST text or env names: report only that this backend
    // failed, which also tells it apart from a failure of the jobs database itself.
    const code = error instanceof Error ? error.message : '';
    throw new Error(AUTHORIZATION_CODES.has(code) ? code : 'APP_BUILDER_AUTH_BACKEND_UNAVAILABLE');
  }
  return {
    workspaceId: actor.workspaceId,
    actorId: actor.actorId,
    actorRole: actor.role,
    permission,
  };
}

export function getDevAppBuilderContext(): never {
  throw new Error('APP_BUILDER_DEV_HEADER_CONTEXT_REMOVED');
}
