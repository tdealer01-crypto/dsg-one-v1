import { NextRequest, NextResponse } from 'next/server';
import { authorizeDsgRoute, workspaceMismatch } from '@/lib/dsg/server/route-auth';
import { runTestCoverage } from '@/skills/test-coverage/skill';

export async function POST(req: NextRequest) {
  // middleware.ts does not cover /api. These handlers run skills (Z3, search, loopback calls) on the server's behalf.
  const auth = await authorizeDsgRoute(req.headers, 'job:read');
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { jobId, workspaceId, previousCoveragePct, currentCoveragePct, threshold } = body as {
      jobId: string;
      workspaceId: string;
      previousCoveragePct: number;
      currentCoveragePct: number;
      threshold?: number;
    };

    if (!jobId || !workspaceId || previousCoveragePct === undefined || currentCoveragePct === undefined) {
      return NextResponse.json({ error: 'jobId, workspaceId, previousCoveragePct, currentCoveragePct required' }, { status: 400 });
    }

    // The workspace comes from the verified session, never from the body.
    const mismatch = workspaceMismatch(auth.actor, workspaceId);
    if (mismatch) return mismatch;

    const result = await runTestCoverage({ jobId, workspaceId, previousCoveragePct, currentCoveragePct, threshold });
    return NextResponse.json({ ok: result.ok, data: result });
  } catch {
    // details stay server-side
    return NextResponse.json({ ok: false, error: { code: 'AGENT_RUN_FAILED' } }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    agent: 'test-coverage',
    description: 'Monitors coverage. Z3 enforces coverage is monotonically non-decreasing.',
    truthBoundary: 'Coverage monotonicity is verified by Z3. Cannot claim full coverage without proof.',
  });
}
