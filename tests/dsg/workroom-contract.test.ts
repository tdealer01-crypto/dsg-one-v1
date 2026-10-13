import { describe, expect, it } from 'vitest';
import {
  catalogRoutes,
  composeWorkroomRoute,
  composeWorkroomRoutes,
  publicWorkroomReceipt,
  spacetimePayloadHash,
  uniqueWorkroomRoute,
  workroomReceiptMatches,
  type WorkroomExecution,
  type WorkroomRoute,
} from '@/lib/dsg/user-bound/workroom-contract';
import { toolArgumentsBoundToUser } from '@/lib/dsg/user-bound/tool-arguments';

const agent = { agent_id: 'dsg-web-workroom', principal: 'oauth:auth0|user-123' };

const lowRoute: WorkroomRoute = {
  route_id: 'route.status',
  source_node: 'node.agent',
  target_node: 'node.cinema-remote',
  capability: 'browser.remote.status',
  approval_required: false,
  signed_approval_required: false,
  bind_payload: false,
};

const highRoute: WorkroomRoute = {
  ...lowRoute,
  route_id: 'route.execute',
  capability: 'browser.remote.execute',
  approval_required: true,
  signed_approval_required: true,
  bind_payload: true,
};

describe('DSG Workroom route and receipt contract', () => {
  it('uses only typed catalog routes and refuses ambiguous route selection', () => {
    const routes = catalogRoutes([
      lowRoute,
      { ...lowRoute, route_id: 42 },
      { ...lowRoute, route_id: 'route.status.2' },
    ]);

    expect(routes).toHaveLength(2);
    expect(() => uniqueWorkroomRoute(routes, 'browser.remote.status', 'node.cinema-remote'))
      .toThrow('ROUTE_NOT_AVAILABLE_OR_AMBIGUOUS');
    expect(uniqueWorkroomRoute([highRoute], 'browser.remote.execute', 'node.cinema-remote'))
      .toMatchObject({ route_id: 'route.execute' });
  });

  it('binds payload only when the live catalog route allows payload binding', () => {
    const request = {
      plan_id: 'plan-1',
      agent,
      payload: { action: 'browser.remote.run', token: 'must-not-be-sent-on-status' },
    };

    expect(composeWorkroomRoute(lowRoute, request, 'status').routes[0]).not.toHaveProperty('payload');
    expect(composeWorkroomRoute(highRoute, request, 'execute').routes[0]).toHaveProperty('payload', request.payload);
    const plan = composeWorkroomRoutes([
      { route: { ...highRoute, route_id: 'route.connect', capability: 'browser.remote.connect' }, payload: { action: 'browser.remote.connect', arguments: { plan_id: 'plan-1' } } },
      { route: highRoute, payload: { action: 'browser.remote.run', arguments: { plan_id: 'plan-1' } } },
    ], { plan_id: 'plan-1', agent }, 'connect then run');
    expect(plan.routes).toHaveLength(2);
    expect(plan.routes.map(route => route.payload && (route.payload as Record<string, unknown>).action))
      .toEqual(['browser.remote.connect', 'browser.remote.run']);
  });

  it('cryptographically binds each execution receipt to the exact plan, payload and decision', async () => {
    const request: WorkroomExecution = {
      plan_id: 'plan-1',
      plan_hash: 'd'.repeat(64),
      route_id: 'route.execute',
      agent,
      payload: { action: 'browser.remote.run', arguments: { url: 'https://dsg.pics' } },
    };
    const result = { ok: true, text: 'done' };
    const payloadHash = await spacetimePayloadHash(request.payload);
    const requestHash = await spacetimePayloadHash({
      plan_id: request.plan_id, plan_hash: request.plan_hash, route_id: request.route_id,
      agent: request.agent, approval_id: null,
    });
    const reason = 'ROUTE_ALLOWED';
    const decisionHash = await spacetimePayloadHash({
      verdict: 'ALLOW', reason, plan_id: request.plan_id, route_id: request.route_id,
      agent_id: request.agent.agent_id, payload_hash: payloadHash, request_hash: requestHash,
    });
    const receipt = {
      decision: { verdict: 'ALLOW', reason, plan_id: request.plan_id, route_id: request.route_id, decision_hash: decisionHash },
      result,
      evidence: {
        plan_id: request.plan_id,
        route_id: request.route_id,
        agent_id: request.agent.agent_id,
        evidence_hash: 'a'.repeat(64),
        request_hash: payloadHash,
        result_hash: await spacetimePayloadHash(result),
        decision_hash: decisionHash,
      },
    };
    expect(await workroomReceiptMatches(receipt, request)).toBe(true);
    expect(await workroomReceiptMatches(receipt, { ...request, plan_hash: 'e'.repeat(64) })).toBe(false);
    expect(await workroomReceiptMatches(receipt, { ...request, payload: { action: 'device.shell.exec' } })).toBe(false);
    expect(await workroomReceiptMatches(receipt, request, 'forged-approval')).toBe(false);
    expect(await workroomReceiptMatches({ ...receipt, result: { ok: true, text: 'forged' } }, request)).toBe(false);
    expect(await workroomReceiptMatches({ ...receipt, evidence: { ...receipt.evidence, route_id: 'route.other' } }, request)).toBe(false);
    expect(await workroomReceiptMatches({ ...receipt, decision: { ...receipt.decision, decision_hash: 'f'.repeat(64) } }, request)).toBe(false);
  });

  it('redacts approval and credential material before rendering receipts', () => {
    expect(publicWorkroomReceipt({
      approval_id: 'permit-secret',
      nested: { accessToken: 'jwt-secret', ok: true },
      cookie: 'session-secret',
      visible: 'safe',
    })).toEqual({ nested: { ok: true }, visible: 'safe' });
  });

  it('allows the authenticated UI to read the catalog but still binds execution to the OAuth principal', () => {
    expect(toolArgumentsBoundToUser('spacetime_capability_catalog', {}, 'auth0|user-123')).toBe(true);
    expect(toolArgumentsBoundToUser('spacetime_execute', {
      plan_id: 'plan-1',
      plan_hash: 'hash',
      route_id: 'route.execute',
      agent,
    }, 'auth0|user-123')).toBe(true);
    expect(toolArgumentsBoundToUser('spacetime_execute', {
      plan_id: 'plan-1',
      plan_hash: 'hash',
      route_id: 'route.execute',
      agent: { ...agent, principal: 'oauth:auth0|other-user' },
    }, 'auth0|user-123')).toBe(false);
  });
});
