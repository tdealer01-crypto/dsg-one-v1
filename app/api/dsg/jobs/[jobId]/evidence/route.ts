import { NextResponse } from 'next/server';
import { requireVerifiedDsgActor } from '@/lib/dsg/server/context';
import { writeEvidence } from '@/lib/dsg/server/repository';
import { getBearerToken } from '@/lib/dsg/server/supabase-rpc';

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const actor = await requireVerifiedDsgActor(request.headers, 'evidence:write');
  const { jobId } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    evidenceType?: string;
    contentHash?: string;
    summary?: string;
    uri?: string;
    metadata?: Record<string, unknown>;
  } | null;

  if (!body?.evidenceType || !body.contentHash || !body.summary) {
    return NextResponse.json({ ok: false, error: { code: 'DSG_EVIDENCE_REQUIRED' } }, { status: 400 });
  }

  try {
    const data = await writeEvidence(
      { workspaceId: actor.workspaceId, actorId: actor.actorId, userAccessToken: getBearerToken(request.headers) },
      {
        jobId,
        evidenceType: body.evidenceType,
        contentHash: body.contentHash,
        summary: body.summary,
        uri: body.uri,
        metadata: body.metadata,
      },
    );
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: { code: error instanceof Error ? error.message : 'DSG_WRITE_EVIDENCE_FAILED' } },
      { status: 403 },
    );
  }
}
