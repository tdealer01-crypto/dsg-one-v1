import { NextResponse } from 'next/server';
import { executeGovernedProposal } from '@/lib/dsg/core-spin/governed-execution';
import { probeAutomationEngine } from '@/lib/dsg/server/automation-spacetime';
import { requireVerifiedDsgActor } from '@/lib/dsg/server/context';

const BROWSER_ROUTES = {
  'browser.remote.status': 'route.cinema-remote.status',
  'browser.remote.connect': 'route.cinema-remote.connect',
  'browser.remote.execute': 'route.cinema-remote.execute',
} as const;

type BrowserCapability = keyof typeof BROWSER_ROUTES;

type AgentExecuteBody = {
  taskId?: string;
  planId?: string;
  intent?: string;
  capability?: BrowserCapability;
  routeId?: string;
  payload?: Record<string, unknown>;
  agentId?: string;
  approvalRequestId?: string;
  approvalDecision?: 'APPROVE' | 'REJECT';
};

function authStatus(code: string) {
  if (code === 'DSG_AUTH_REQUIRED') return 401;
  if (code === 'DSG_CONTEXT_REQUIRED' || code === 'DSG_PERMISSION_DENIED') return 403;
  return 500;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export async function POST(request: Request) {
  let actor: Awaited<ReturnType<typeof requireVerifiedDsgActor>>;
  try {
    actor = await requireVerifiedDsgActor(request.headers, 'job:control');
  } catch (error) {
    const code = error instanceof Error ? error.message : 'DSG_AUTH_FAILED';
    return NextResponse.json({ ok: false, error: { code } }, { status: authStatus(code) });
  }

  const body = await request.json().catch(() => null) as AgentExecuteBody | null;
  const capability = body?.capability;
  if (!capability || !(capability in BROWSER_ROUTES)) {
    return NextResponse.json(
      { ok: false, error: { code: 'AGENT_BROWSER_CAPABILITY_REQUIRED' } },
      { status: 400 },
    );
  }

  const routeId = BROWSER_ROUTES[capability];
  if (body?.routeId && body.routeId !== routeId) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'AGENT_BROWSER_ROUTE_MISMATCH',
          expectedRouteId: routeId,
        },
      },
      { status: 400 },
    );
  }

  if (body?.payload !== undefined && !isRecord(body.payload)) {
    return NextResponse.json(
      { ok: false, error: { code: 'AGENT_BROWSER_PAYLOAD_INVALID' } },
      { status: 400 },
    );
  }

  const taskId = body.taskId?.trim() || `agent-browser-${crypto.randomUUID()}`;
  const planId = body.planId?.trim() || `agent-browser-plan-${crypto.randomUUID()}`;
  const agentId = body.agentId?.trim() || 'dsg-agent-runtime';
  const intent = body.intent?.trim() || `Execute governed ${capability}`;

  try {
    // This is a fail-closed orchestration readiness gate. The Agent Framework
    // validates runtime readiness; DSG Spacetime remains the execution authority.
    const automationEngine = await probeAutomationEngine();

    const result = await executeGovernedProposal({
      taskId,
      planId,
      intent,
      capability,
      routeId,
      payload: body.payload,
      agentId,
      principal: `workspace:${actor.workspaceId}`,
      approvalRequestId: body.approvalRequestId?.trim() || undefined,
      approvalDecision: body.approvalDecision,
    });

    const ok = result.state === 'COMPLETED' || result.state === 'WAITING_APPROVAL';
    const status = result.state === 'FAILED' ? 502 : result.state === 'WAITING_APPROVAL' ? 202 : 200;

    return NextResponse.json({
      ok,
      data: {
        taskId,
        planId,
        capability,
        routeId,
        automationEngine,
        executionAuthority: 'dsg-spacetime',
        directProviderAccess: false,
        result,
      },
    }, { status });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'AGENT_EXECUTION_FAILED';
    return NextResponse.json(
      {
        ok: false,
        error: {
          code,
          executionAuthority: 'none',
          directProviderAccess: false,
        },
      },
      { status: 503 },
    );
  }
}
