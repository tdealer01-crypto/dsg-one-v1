export type JsonRecord = Record<string, unknown>;
export type WorkroomRoute = {
  route_id: string;
  source_node: string;
  target_node: string;
  capability: string;
  approval_required: boolean;
  signed_approval_required: boolean;
  bind_payload: boolean;
};
export type WorkroomExecution = {
  plan_id: string;
  plan_hash: string;
  route_id: string;
  agent: { agent_id: string; principal: string };
  payload: JsonRecord;
};
export type WorkroomStepDraft = {
  route: WorkroomRoute;
  payload: JsonRecord;
};

export function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord : null;
}

export function catalogRoutes(value: unknown): WorkroomRoute[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is WorkroomRoute => {
    const row = asRecord(item);
    return Boolean(row && ['route_id', 'source_node', 'target_node', 'capability']
      .every(key => typeof row[key] === 'string') &&
      ['approval_required', 'signed_approval_required', 'bind_payload']
        .every(key => typeof row[key] === 'boolean'));
  });
}

// Select only a route returned by the currently authenticated catalog.
export function uniqueWorkroomRoute(routes: WorkroomRoute[], capability: string, target: string) {
  const matches = routes.filter(route => route.capability === capability && route.target_node === target);
  if (matches.length !== 1) throw new Error('ROUTE_NOT_AVAILABLE_OR_AMBIGUOUS');
  return matches[0];
}

export function composeWorkroomRoute(route: WorkroomRoute, request: Omit<WorkroomExecution, 'plan_hash' | 'route_id'>, intent: string) {
  return composeWorkroomRoutes([{ route, payload: request.payload }], {
    plan_id: request.plan_id,
    agent: request.agent,
  }, intent);
}

export function composeWorkroomRoutes(steps: WorkroomStepDraft[],
  request: Pick<WorkroomExecution, 'plan_id' | 'agent'>, intent: string) {
  return {
    plan_id: request.plan_id,
    intent: intent.slice(0, 4000),
    participants: [request.agent],
    routes: steps.map(({ route, payload }) => ({
      source_node: route.source_node,
      target_node: route.target_node,
      capability: route.capability,
      ...(route.bind_payload ? { payload } : {}),
    })),
  };
}

// Match the Python SpacetimeRuntime._canonical/_hash contract: sorted UTF-8 JSON,
// without whitespace or ASCII-escaping. Used only for verifying provider receipts.
function spacetimeCanonical(value: unknown): string {
  function normalized(input: unknown): unknown {
    if (Array.isArray(input)) return input.map(normalized);
    const row = asRecord(input);
    if (!row) return input;
    return Object.fromEntries(Object.keys(row).sort().map(key => [key, normalized(row[key])]));
  }
  return JSON.stringify(normalized(value));
}

export async function spacetimePayloadHash(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(spacetimeCanonical(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function workroomReceiptMatches(receipt: unknown, request: WorkroomExecution, approvalId?: string): Promise<boolean> {
  const row = asRecord(receipt);
  const decision = asRecord(row?.decision);
  const evidence = asRecord(row?.evidence);
  const result = asRecord(row?.result);
  const hash = /^[a-f0-9]{64}$/;
  if (!decision || !evidence || !result || Object.keys(result).length === 0 ||
      decision.verdict !== 'ALLOW' || typeof decision.reason !== 'string' ||
      result.ok === false || result.isError === true ||
      !hash.test(request.plan_hash) ||
      decision.plan_id !== request.plan_id || decision.route_id !== request.route_id ||
      evidence.plan_id !== request.plan_id || evidence.route_id !== request.route_id ||
      evidence.agent_id !== request.agent.agent_id ||
      !['evidence_hash', 'request_hash', 'result_hash', 'decision_hash']
        .every(key => typeof evidence[key] === 'string' && hash.test(evidence[key] as string))) return false;
  // No unsigned plan_hash is present in the live execution envelope. Instead,
  // recompute the decision hash that cryptographically binds plan_hash, route,
  // principal, approval ID (if any), and the exact action payload.
  const payloadHash = await spacetimePayloadHash(request.payload);
  const requestHash = await spacetimePayloadHash({
    plan_id: request.plan_id, plan_hash: request.plan_hash, route_id: request.route_id,
    agent: request.agent, approval_id: approvalId ?? null,
  });
  const decisionHash = await spacetimePayloadHash({
    verdict: 'ALLOW', reason: decision.reason, plan_id: request.plan_id,
    route_id: request.route_id, agent_id: request.agent.agent_id,
    payload_hash: payloadHash, request_hash: requestHash,
  });
  return evidence.request_hash === payloadHash &&
    evidence.result_hash === await spacetimePayloadHash(result) &&
    decision.decision_hash === decisionHash && evidence.decision_hash === decisionHash;
}

export function publicWorkroomReceipt(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(publicWorkroomReceipt);
  const row = asRecord(value);
  if (!row) return value;
  return Object.fromEntries(Object.entries(row)
    .filter(([key]) => !/token|secret|password|cookie|authorization|approval_id/i.test(key))
    .map(([key, item]) => [key, publicWorkroomReceipt(item)]));
}
