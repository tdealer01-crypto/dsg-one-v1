import { NextRequest, NextResponse } from 'next/server';
import { authorizeDsgRoute, workspaceMismatch } from '@/lib/dsg/server/route-auth';
import { runSecurityGate } from '@/skills/security-gate/skill';

export async function POST(req: NextRequest) {
  // middleware.ts does not cover /api. These handlers run skills (Z3, search, loopback calls) on the server's behalf.
  const auth = await authorizeDsgRoute(req.headers, 'job:read');
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { actionId, agentType, workspaceId, riskLevel, evidenceExists, mockState, requiresApproval } = body as {
      actionId: string;
      agentType: string;
      workspaceId: string;
      riskLevel: 'low' | 'medium' | 'high' | 'critical';
      evidenceExists: boolean;
      mockState?: boolean;
      requiresApproval?: boolean;
    };

    if (!actionId || !agentType || !workspaceId) {
      return NextResponse.json({ error: 'actionId, agentType, workspaceId required' }, { status: 400 });
    }

    // The workspace comes from the verified session, never from the body.
    const mismatch = workspaceMismatch(auth.actor, workspaceId);
    if (mismatch) return mismatch;

    const result = await runSecurityGate({
      actionId,
      agentType,
      workspaceId,
      riskLevel: riskLevel ?? 'low',
      evidenceExists: evidenceExists ?? false,
      mockState: mockState ?? false,
      requiresApproval: requiresApproval ?? false,
    });
    return NextResponse.json({ ok: result.ok, data: result });
  } catch {
    // details stay server-side
    return NextResponse.json({ ok: false, error: { code: 'AGENT_RUN_FAILED' } }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    agent: 'security-gate',
    description: 'Gate check for all agent actions. gate_allow required before any execution.',
    truthBoundary: 'Gate evaluates decisions only. Does not execute actions.',
  });
}
