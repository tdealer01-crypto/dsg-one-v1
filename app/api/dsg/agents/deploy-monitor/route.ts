import { NextRequest, NextResponse } from 'next/server';
import { authorizeDsgRoute, workspaceMismatch } from '@/lib/dsg/server/route-auth';
import { runDeployMonitor } from '@/skills/deploy-monitor/skill';

export async function POST(req: NextRequest) {
  // middleware.ts does not cover /api. These handlers run skills (Z3, search, loopback calls) on the server's behalf.
  const auth = await authorizeDsgRoute(req.headers, 'job:control');
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { jobId, workspaceId, deploymentUrl, gateAllow, mockState } = body as {
      jobId: string;
      workspaceId: string;
      deploymentUrl: string;
      gateAllow: boolean;
      mockState?: boolean;
    };

    if (!jobId || !workspaceId || !deploymentUrl) {
      return NextResponse.json({ error: 'jobId, workspaceId, deploymentUrl required' }, { status: 400 });
    }

    // The workspace comes from the verified session, never from the body.
    const mismatch = workspaceMismatch(auth.actor, workspaceId);
    if (mismatch) return mismatch;

    const result = await runDeployMonitor({ jobId, workspaceId, deploymentUrl, gateAllow: gateAllow ?? false, mockState });
    return NextResponse.json({ ok: result.ok, data: result });
  } catch {
    // details stay server-side
    return NextResponse.json({ ok: false, error: { code: 'AGENT_RUN_FAILED' } }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    agent: 'deploy-monitor',
    description: 'Verifies deployment evidence for the configured deployment URL. A deploy action is eligible only after gate_allow + evidence + no mock_state.',
    truthBoundary: 'Provider status alone is not production proof. Never claims production-ready without deployment evidence and proof hash.',
  });
}
