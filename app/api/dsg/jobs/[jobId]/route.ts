import { NextResponse } from 'next/server';
import { getDsgUserAccessToken, requireVerifiedDsgActor } from '@/lib/dsg/server/context';
import { getRuntimeJobTimeline } from '@/lib/dsg/server/repository';

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const actor = await requireVerifiedDsgActor(request.headers, 'job:read');
  const { jobId } = await context.params;

  try {
    const data = await getRuntimeJobTimeline(
      { workspaceId: actor.workspaceId, actorId: actor.actorId, userAccessToken: getDsgUserAccessToken(request.headers) },
      jobId,
    );
    return NextResponse.json({ ok: true, data, source: 'supabase' });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: { code: error instanceof Error ? error.message : 'DSG_GET_JOB_FAILED' } },
      { status: 403 },
    );
  }
}
