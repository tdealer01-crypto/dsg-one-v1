type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function exactAgent(agent: unknown, principal: string): boolean {
  return isObject(agent) &&
    typeof agent.agent_id === 'string' &&
    agent.agent_id.length > 0 && agent.agent_id.length <= 64 &&
    agent.principal === principal;
}

export function toolArgumentsBoundToUser(name: string, args: unknown, subject: string): boolean {
  if (!isObject(args)) return false;
  const principal = 'oauth:' + subject;
  switch (name) {
    case 'spacetime_read_public_repo':
    case 'spacetime_verify_evidence':
    case 'spacetime_control_surface':
      return Object.keys(args).length === 0;
    case 'spacetime_discover':
      return Array.isArray(args.capabilities) && args.capabilities.length > 0 &&
        args.capabilities.length <= 20 &&
        args.capabilities.every((cap: unknown) => typeof cap === 'string' && cap.length > 0 && cap.length <= 128);
    case 'spacetime_compose':
      return Array.isArray(args.participants) && args.participants.length > 0 &&
        args.participants.length <= 8 &&
        args.participants.every((p: unknown) => exactAgent(p, principal));
    case 'spacetime_request_approval':
      return isObject(args.request) && exactAgent(args.request.agent, principal) &&
        typeof args.request.plan_id === 'string' &&
        typeof args.request.plan_hash === 'string' &&
        typeof args.request.route_id === 'string';
    case 'spacetime_execute':
      return exactAgent(args.agent, principal) &&
        typeof args.plan_id === 'string' &&
        typeof args.plan_hash === 'string' &&
        typeof args.route_id === 'string';
    case 'spacetime_list_pending_approvals':
      return Object.keys(args).length === 0;
    case 'spacetime_get_approval':
    case 'spacetime_claim_approval':
      return Object.keys(args).length === 1 &&
        typeof args.approval_request_id === 'string' &&
        args.approval_request_id.length > 0 && args.approval_request_id.length <= 192;
    case 'spacetime_resolve_approval':
      return Object.keys(args).length === 2 &&
        typeof args.approval_request_id === 'string' &&
        args.approval_request_id.length > 0 && args.approval_request_id.length <= 192 &&
        (args.decision === 'APPROVE' || args.decision === 'REJECT');
    default:
      return false;
  }
}
