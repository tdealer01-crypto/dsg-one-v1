import { NextRequest, NextResponse } from 'next/server';
import { authorizeDsgRoute, workspaceMismatch } from '@/lib/dsg/server/route-auth';
import { runBrowserResearch } from '@/skills/browser-research/skill';

export async function POST(req: NextRequest) {
  // middleware.ts does not cover /api. These handlers run skills (Z3, search, loopback calls) on the server's behalf.
  const auth = await authorizeDsgRoute(req.headers, 'job:control');
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { jobId, workspaceId, researchQuery, targetUrl } = body as {
      jobId: string;
      workspaceId: string;
      researchQuery: string;
      targetUrl?: string;
    };

    if (!jobId || !workspaceId || !researchQuery) {
      return NextResponse.json({ error: 'jobId, workspaceId, researchQuery required' }, { status: 400 });
    }

    // The workspace comes from the verified session, never from the body.
    const mismatch = workspaceMismatch(auth.actor, workspaceId);
    if (mismatch) return mismatch;

    const result = await runBrowserResearch({ jobId, workspaceId, researchQuery, targetUrl });
    return NextResponse.json({ ok: result.ok, data: result });
  } catch {
    // details stay server-side
    return NextResponse.json({ ok: false, error: { code: 'AGENT_RUN_FAILED' } }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    agent: 'browser-research',
    description: 'Browser research with SHA256 evidence. No hash = BLOCK.',
    truthBoundary: 'All browser results carry tamper-evident hashes stored in dsg_evidence_items.',
  });
}
