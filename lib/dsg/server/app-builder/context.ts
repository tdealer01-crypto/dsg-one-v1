export type AppBuilderRequestContext = {
  workspaceId: string;
  actorId: string;
};

export function getDevAppBuilderContext(req: Request): AppBuilderRequestContext {
  const workspaceId = req.headers.get('x-dsg-workspace-id');
  const actorId = req.headers.get('x-dsg-actor-id');

  if (!workspaceId) throw new Error('WORKSPACE_ID_REQUIRED');
  if (!actorId) throw new Error('ACTOR_ID_REQUIRED');

  return { workspaceId, actorId };
}
