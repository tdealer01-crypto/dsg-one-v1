import { NextRequest, NextResponse } from 'next/server';
import { authorizeDsgRoute, workspaceMismatch } from '@/lib/dsg/server/route-auth';
import { runOrchestrator } from '@/skills/orchestrator/skill';

export async function POST(req: NextRequest) {
  // middleware.ts does not cover /api. These handlers run skills (Z3, search, loopback calls) on the server's behalf.
  const auth = await authorizeDsgRoute(req.headers, 'job:control');
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { jobId, workspaceId, goal, goalLocked, subGoals } = body as {
      jobId: string;
      workspaceId: string;
      goal: string;
      goalLocked: boolean;
      subGoals: Array<{ agentType: string; goal: string }>;
    };

    if (!jobId || !workspaceId || !goal) {
      return NextResponse.json({ error: 'jobId, workspaceId, goal required' }, { status: 400 });
    }

    // The workspace comes from the verified session, never from the body.
    const mismatch = workspaceMismatch(auth.actor, workspaceId);
    if (mismatch) return mismatch;

    if (Array.isArray(subGoals) && subGoals.length > 6) {
      return NextResponse.json({ ok: false, error: { code: 'DSG_TOO_MANY_SUBGOALS', max: 6 } }, { status: 400 });
    }

    const result = await runOrchestrator({ jobId, workspaceId, goal, goalLocked: goalLocked ?? false, subGoals: subGoals ?? [] });
    return NextResponse.json({ ok: result.ok, data: result });
  } catch {
    // details stay server-side
    return NextResponse.json({ ok: false, error: { code: 'AGENT_RUN_FAILED' } }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    agent: 'orchestrator',
    description: 'Coordinates all agents. Requires goal_locked before dispatch.',
    truthBoundary: 'Manages dispatch order only. Does not execute code or deploy.',
  });
}
