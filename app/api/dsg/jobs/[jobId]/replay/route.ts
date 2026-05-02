import { NextResponse } from 'next/server';
import { assertDsgPermission, devHeaderActor } from '@/lib/dsg/server/context';
import { recordReplayProof } from '@/lib/dsg/server/repository';
import { getBearerToken } from '@/lib/dsg/server/supabase-rpc';

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const actor = assertDsgPermission(devHeaderActor(request.headers), 'replay:verify');
  const { jobId } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    replayHash?: string;
    status?: 'PASS' | 'BLOCK' | 'FAILED';
    details?: Record<string, unknown>;
  } | null;

  if (!body?.replayHash || !body.status) {
    return NextResponse.json({ ok: false, error: { code: 'DSG_REPLAY_REQUIRED' } }, { status: 400 });
  }

  try {
    const data = await recordReplayProof(
      { workspaceId: actor.workspaceId, actorId: actor.actorId, userAccessToken: getBearerToken(request.headers) },
      { jobId, replayHash: body.replayHash, status: body.status, details: body.details },
    );
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: { code: error instanceof Error ? error.message : 'DSG_RECORD_REPLAY_FAILED' } },
      { status: 403 },
    );
  }
}
