import { NextRequest, NextResponse } from 'next/server';
import { authorizeDsgRoute, workspaceMismatch } from '@/lib/dsg/server/route-auth';
import { runCodeEvolution } from '@/skills/code-evolution/skill';

export async function POST(req: NextRequest) {
  // middleware.ts does not cover /api. These handlers run skills (Z3, search, loopback calls) on the server's behalf.
  const auth = await authorizeDsgRoute(req.headers, 'job:control');
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { jobId, workspaceId, goal, planApproved, isDestructiveWrite, destructionProof } = body as {
      jobId: string;
      workspaceId: string;
      goal: string;
      planApproved: boolean;
      isDestructiveWrite?: boolean;
      destructionProof?: boolean;
    };

    if (!jobId || !workspaceId || !goal) {
      return NextResponse.json({ error: 'jobId, workspaceId, goal required' }, { status: 400 });
    }

    // The workspace comes from the verified session, never from the body.
    const mismatch = workspaceMismatch(auth.actor, workspaceId);
    if (mismatch) return mismatch;

    const result = await runCodeEvolution({ jobId, workspaceId, goal, planApproved: planApproved ?? false, isDestructiveWrite, destructionProof });
    return NextResponse.json({ ok: result.ok, data: result });
  } catch {
    // details stay server-side
    return NextResponse.json({ ok: false, error: { code: 'AGENT_RUN_FAILED' } }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    agent: 'code-evolution',
    description: 'Writes code with approved plan. Seeded with real codebase state.',
    truthBoundary: 'Creates PR evidence only. CI and deployment proof are separate.',
  });
}
