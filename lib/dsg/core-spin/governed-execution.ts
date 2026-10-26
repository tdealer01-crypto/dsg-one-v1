import {
  callSpacetimeTool,
  type SpacetimeToolResult,
} from '@/lib/dsg/spacetime/client';

export type CoreSpinState =
  | 'COMPLETED'
  | 'WAITING_APPROVAL'
  | 'BLOCKED'
  | 'FAILED';

export type CoreSpinWorldContext = {
  missionId: string;
  ownerId: string;
  actorAvatarId: string;
  worldId: string;
  regionId: string;
  expectedStateVersion?: number;
};

export type CoreSpinActionProposal = {
  taskId: string;
  planId: string;
  intent: string;
  capability: string;
  routeId?: string;
  payload?: Record<string, unknown>;
  agentId: string;
  principal: string;
  worldContext?: CoreSpinWorldContext;
  approvalRequestId?: string;
  approvalDecision?: 'APPROVE' | 'REJECT';
};

export type CoreSpinExecutionResult = {
  state: CoreSpinState;
  routeId?: string;
  planHash?: string;
  approvalRequestId?: string;
  decision?: Record<string, unknown>;
  result?: unknown;
  evidence?: unknown;
  evidenceChain?: SpacetimeToolResult;
  reason?: string;
};

type DiscoveredRoute = {
  route_id: string;
  source_node: string;
  target_node: string;
  capability: string;
  approval_required?: boolean;
  signed_approval_required?: boolean;
  bind_payload?: boolean;
};

function routesFrom(result: SpacetimeToolResult): DiscoveredRoute[] {
  return Array.isArray(result.routes)
    ? result.routes.filter((item): item is DiscoveredRoute => Boolean(
        item
        && typeof item === 'object'
        && typeof (item as DiscoveredRoute).route_id === 'string',
      ))
    : [];
}

function exactRoute(
  routes: DiscoveredRoute[],
  proposal: CoreSpinActionProposal,
): DiscoveredRoute {
  const matching = routes.filter((route) =>
    route.capability === proposal.capability
    && (!proposal.routeId || route.route_id === proposal.routeId),
  );
  if (matching.length !== 1) throw new Error('CORE_SPIN_ROUTE_NOT_UNIQUE');
  return matching[0];
}

function approvalIdFrom(result: SpacetimeToolResult): string | undefined {
  const direct = result.approval_id;
  if (typeof direct === 'string' && direct) return direct;
  const approval = result.approval;
  if (!approval || typeof approval !== 'object') return undefined;
  const token = (approval as Record<string, unknown>).approval_id;
  return typeof token === 'string' && token ? token : undefined;
}

function approvalRequestIdFrom(result: SpacetimeToolResult): string | undefined {
  const approval = result.approval;
  if (!approval || typeof approval !== 'object') return undefined;
  const id = (approval as Record<string, unknown>).approval_request_id;
  return typeof id === 'string' && id ? id : undefined;
}

function approvalRecord(result: SpacetimeToolResult): Record<string, unknown> {
  return result.approval && typeof result.approval === 'object' && !Array.isArray(result.approval)
    ? result.approval as Record<string, unknown>
    : {};
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  const record = value as Record<string, unknown>;
  return '{' + Object.keys(record).sort()
    .map((key) => JSON.stringify(key) + ':' + canonicalJson(record[key]))
    .join(',') + '}';
}

function exactApprovalPayload(actual: unknown, expected: unknown): boolean {
  return actual !== undefined && canonicalJson(actual) === canonicalJson(expected);
}

function approvalStatusText(result: SpacetimeToolResult): string {
  const approval = approvalRecord(result);
  return [
    approval.status,
    result.status,
    result.verdict,
    approval.reason,
    result.reason,
  ].filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toUpperCase();
}

function approvalStillPending(result: SpacetimeToolResult): boolean {
  return /PENDING|WAITING|NOT[_ -]?READY|NOT[_ -]?APPROVED/.test(approvalStatusText(result));
}

function approvalTerminal(result: SpacetimeToolResult): boolean {
  return /REJECT|EXPIRE|CANCEL|DENY|NOT[_ -]?FOUND|INVALID/.test(approvalStatusText(result));
}

function validateWorldContext(proposal: CoreSpinActionProposal): string | undefined {
  const context = proposal.worldContext;
  if (!context) return undefined;

  if (
    !context.missionId
    || !context.ownerId
    || !context.actorAvatarId
    || !context.worldId
    || !context.regionId
  ) {
    return 'CORE_SPIN_WORLD_CONTEXT_INCOMPLETE';
  }
  if (
    context.expectedStateVersion !== undefined
    && (
      !Number.isSafeInteger(context.expectedStateVersion)
      || context.expectedStateVersion < 0
    )
  ) {
    return 'CORE_SPIN_WORLD_STATE_VERSION_INVALID';
  }

  const payload = proposal.payload;
  if (!payload || typeof payload !== 'object') {
    return 'CORE_SPIN_WORLD_CONTEXT_NOT_BOUND';
  }

  const isXrWorldRoute =
    proposal.capability === 'world.read'
    || proposal.capability === 'world.write'
    || proposal.routeId?.startsWith('route.xr-world.') === true;

  if (isXrWorldRoute) {
    // XR world schema v1 is a strict top-level payload. Its mission identity is
    // bound by the Spacetime execution plan id, while owner/avatar/world/region
    // are bound directly into the adapter payload.
    if (proposal.planId !== context.missionId) {
      return 'CORE_SPIN_WORLD_MISSION_PLAN_MISMATCH';
    }
    if ('arguments' in payload) {
      return 'CORE_SPIN_XR_WORLD_PAYLOAD_WRAPPED';
    }

    const bindings: Array<[string, string | number | undefined, boolean]> = [
      ['owner_id', context.ownerId, true],
      ['actor_avatar_id', context.actorAvatarId, true],
      ['world_id', context.worldId, true],
      ['region_id', context.regionId, true],
      ['expected_state_version', context.expectedStateVersion, context.expectedStateVersion !== undefined],
    ];

    for (const [field, expected, required] of bindings) {
      if (required && !(field in payload)) {
        return 'CORE_SPIN_WORLD_CONTEXT_NOT_BOUND';
      }
      if (
        field in payload
        && expected !== undefined
        && payload[field] !== expected
      ) {
        return 'CORE_SPIN_WORLD_CONTEXT_MISMATCH';
      }
    }
    return undefined;
  }

  const args = payload.arguments;
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    return 'CORE_SPIN_WORLD_CONTEXT_NOT_BOUND';
  }

  const record = args as Record<string, unknown>;
  const bindings: Array<[string, string | number | undefined, boolean]> = [
    ['mission_id', context.missionId, true],
    ['owner_id', context.ownerId, true],
    ['actor_avatar_id', context.actorAvatarId, true],
    ['world_id', context.worldId, true],
    ['region_id', context.regionId, true],
    ['expected_state_version', context.expectedStateVersion, false],
  ];

  for (const [field, expected, required] of bindings) {
    if (required && !(field in record)) {
      return 'CORE_SPIN_WORLD_CONTEXT_NOT_BOUND';
    }
    if (
      field in record
      && expected !== undefined
      && record[field] !== expected
    ) {
      return 'CORE_SPIN_WORLD_CONTEXT_MISMATCH';
    }
    if (field in record && expected === undefined) {
      return 'CORE_SPIN_WORLD_CONTEXT_MISMATCH';
    }
  }
  return undefined;
}

export async function executeGovernedProposal(
  proposal: CoreSpinActionProposal,
): Promise<CoreSpinExecutionResult> {
  if (!proposal.taskId || !proposal.planId || !proposal.intent || !proposal.capability) {
    return { state: 'BLOCKED', reason: 'CORE_SPIN_PROPOSAL_INCOMPLETE' };
  }
  if (!proposal.agentId || !proposal.principal) {
    return { state: 'BLOCKED', reason: 'CORE_SPIN_AGENT_IDENTITY_REQUIRED' };
  }

  const worldContextError = validateWorldContext(proposal);
  if (worldContextError) {
    return { state: 'BLOCKED', reason: worldContextError };
  }

  try {
    const discovered = await callSpacetimeTool('spacetime_discover', {
      capabilities: [proposal.capability],
    });
    const route = exactRoute(routesFrom(discovered), proposal);
    if (route.bind_payload && !proposal.payload) {
      return { state: 'BLOCKED', routeId: route.route_id, reason: 'CORE_SPIN_BOUND_PAYLOAD_REQUIRED' };
    }

    const browserAction =
      route.capability === 'browser.remote.execute'
        ? 'browser.remote.run'
        : route.capability.startsWith('browser.remote.')
          ? route.capability
          : undefined;
    const executionPayload = proposal.payload ?? (
      browserAction
        ? { action: browserAction, arguments: {} }
        : {}
    );
    if (
      browserAction
      && (
        executionPayload.action !== browserAction
        || (
          'arguments' in executionPayload
          && executionPayload.arguments !== null
          && typeof executionPayload.arguments !== 'object'
        )
      )
    ) {
      return {
        state: 'BLOCKED',
        routeId: route.route_id,
        reason: 'CORE_SPIN_EXECUTION_PAYLOAD_SCOPE_MISMATCH',
      };
    }

    const agent = { agent_id: proposal.agentId, principal: proposal.principal };
    const approvalRequired = Boolean(
      route.signed_approval_required || route.approval_required,
    );
    const request: Record<string, unknown> = {
      plan_id: proposal.planId,
      route_id: route.route_id,
      agent,
      payload: executionPayload,
    };
    let planHash: string;

    if (approvalRequired && proposal.approvalRequestId) {
      if (!proposal.approvalDecision) {
        return {
          state: 'WAITING_APPROVAL',
          routeId: route.route_id,
          approvalRequestId: proposal.approvalRequestId,
        };
      }

      if (proposal.approvalDecision === 'REJECT') {
        return {
          state: 'BLOCKED',
          routeId: route.route_id,
          approvalRequestId: proposal.approvalRequestId,
          reason: 'CORE_SPIN_APPROVAL_REJECTED',
        };
      }

      // Read the exact approval metadata before consuming its one-use permit.
      // The lookup is non-consuming; only the claim below may mint/consume it.
      const details = await callSpacetimeTool('spacetime_get_approval', {
        approval_request_id: proposal.approvalRequestId,
      });
      if (approvalStillPending(details)) {
        return {
          state: 'WAITING_APPROVAL',
          routeId: route.route_id,
          approvalRequestId: proposal.approvalRequestId,
          reason: String(details.reason ?? 'CORE_SPIN_HUMAN_APPROVAL_NOT_READY'),
        };
      }
      if (approvalTerminal(details)) {
        return {
          state: 'BLOCKED',
          routeId: route.route_id,
          approvalRequestId: proposal.approvalRequestId,
          reason: String(details.reason ?? 'CORE_SPIN_APPROVAL_NOT_AVAILABLE'),
        };
      }

      const detailsApproval = approvalRecord(details);
      if (
        detailsApproval.approval_request_id !== proposal.approvalRequestId
        || detailsApproval.plan_id !== proposal.planId
        || detailsApproval.route_id !== route.route_id
        || detailsApproval.agent_id !== proposal.agentId
        || typeof detailsApproval.plan_hash !== 'string'
        || !exactApprovalPayload(detailsApproval.payload, executionPayload)
      ) {
        return {
          state: 'BLOCKED',
          routeId: route.route_id,
          approvalRequestId: proposal.approvalRequestId,
          reason: 'CORE_SPIN_APPROVAL_BINDING_MISMATCH',
        };
      }

      // Human authority is resolved only by the dedicated Auth0/MFA approval
      // surface. Core Spin must never resolve an approval with its internal
      // credential; it can only claim the resulting one-use permit.
      const claimed = await callSpacetimeTool('spacetime_claim_approval', {
        approval_request_id: proposal.approvalRequestId,
      });
      if (claimed.verdict !== 'APPROVED') {
        return {
          state: approvalStillPending(claimed) ? 'WAITING_APPROVAL' : 'BLOCKED',
          routeId: route.route_id,
          approvalRequestId: proposal.approvalRequestId,
          reason: String(claimed.reason ?? 'CORE_SPIN_HUMAN_APPROVAL_NOT_READY'),
        };
      }

      const approval = approvalRecord(claimed);
      const boundPlanHash = approval.plan_hash;
      const boundPlanId = approval.plan_id;
      const boundRouteId = approval.route_id;
      const boundAgentId = approval.agent_id;
      if (
        typeof boundPlanHash !== 'string'
        || boundPlanId !== proposal.planId
        || boundRouteId !== route.route_id
        || boundAgentId !== proposal.agentId
        || !exactApprovalPayload(approval.payload, executionPayload)
      ) {
        return {
          state: 'BLOCKED',
          routeId: route.route_id,
          approvalRequestId: proposal.approvalRequestId,
          reason: 'CORE_SPIN_APPROVAL_BINDING_MISMATCH',
        };
      }

      const approvalId = approvalIdFrom(claimed);
      if (!approvalId) {
        return {
          state: 'BLOCKED',
          routeId: route.route_id,
          planHash: boundPlanHash,
          approvalRequestId: proposal.approvalRequestId,
          reason: String(claimed.reason ?? 'CORE_SPIN_APPROVAL_TOKEN_MISSING'),
        };
      }
      planHash = boundPlanHash;
      request.plan_hash = planHash;
      request.approval_id = approvalId;
    } else {
      if (!approvalRequired && proposal.approvalRequestId) {
        return {
          state: 'BLOCKED',
          routeId: route.route_id,
          reason: 'CORE_SPIN_UNEXPECTED_APPROVAL',
        };
      }

      const composed = await callSpacetimeTool('spacetime_compose', {
        plan_id: proposal.planId,
        intent: proposal.intent,
        participants: [agent],
        routes: [{
          source_node: route.source_node,
          target_node: route.target_node,
          capability: route.capability,
          ...(route.bind_payload ? { payload: proposal.payload } : {}),
        }],
      });
      if (composed.verdict !== 'BOUND' || typeof composed.plan_hash !== 'string') {
        return {
          state: 'BLOCKED',
          routeId: route.route_id,
          reason: String(composed.reason ?? 'CORE_SPIN_COMPOSE_BLOCKED'),
        };
      }
      planHash = composed.plan_hash;
      request.plan_hash = planHash;

      if (approvalRequired) {
        const pending = await callSpacetimeTool('spacetime_request_approval', {
          request,
          ttl_seconds: 300,
        });
        const approvalRequestId = approvalRequestIdFrom(pending);
        if (pending.verdict !== 'PENDING' || !approvalRequestId) {
          return {
            state: 'BLOCKED',
            routeId: route.route_id,
            planHash,
            reason: String(pending.reason ?? 'CORE_SPIN_APPROVAL_REQUEST_BLOCKED'),
          };
        }
        return {
          state: 'WAITING_APPROVAL',
          routeId: route.route_id,
          planHash,
          approvalRequestId,
        };
      }
    }

    const executed = await callSpacetimeTool('spacetime_execute', request);
    const decision = executed.decision && typeof executed.decision === 'object'
      ? executed.decision as Record<string, unknown>
      : {};
    if (decision.verdict !== 'ALLOW') {
      return {
        state: 'BLOCKED',
        routeId: route.route_id,
        planHash,
        decision,
        reason: String(decision.reason ?? executed.reason ?? 'CORE_SPIN_EXECUTION_BLOCKED'),
      };
    }

    const evidenceChain = await callSpacetimeTool('spacetime_verify_evidence', {});
    if (evidenceChain.valid !== true) {
      return {
        state: 'FAILED',
        routeId: route.route_id,
        planHash,
        decision,
        result: executed.result,
        evidence: executed.evidence,
        evidenceChain,
        reason: 'CORE_SPIN_EVIDENCE_CHAIN_INVALID',
      };
    }

    return {
      state: 'COMPLETED',
      routeId: route.route_id,
      planHash,
      decision,
      result: executed.result,
      evidence: executed.evidence,
      evidenceChain,
    };
  } catch (error) {
    return {
      state: 'FAILED',
      reason: error instanceof Error ? error.message : 'CORE_SPIN_EXECUTION_FAILED',
    };
  }
}
