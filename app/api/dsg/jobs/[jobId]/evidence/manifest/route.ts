import { NextResponse } from 'next/server';
import { assertDsgPermission, devHeaderActor } from '@/lib/dsg/server/context';
import { createEvidenceManifest } from '@/lib/dsg/server/repository';
import { getBearerToken } from '@/lib/dsg/server/supabase-rpc';

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const actor = assertDsgPermission(devHeaderActor(request.headers), 'evidence:write');
  const { jobId } = await context.params;
  const body = (await request.json().catch(() => null)) as { manifestHash?: string; evidenceIds?: string[] } | null;
  if (!body?.manifestHash || !body.evidenceIds?.length) {
    return NextResponse.json({ ok: false, error: { code: 'DSG_MANIFEST_REQUIRED' } }, { status: 400 });
  }

  try {
    const data = await createEvidenceManifest(
      { workspaceId: actor.workspaceId, actorId: actor.actorId, userAccessToken: getBearerToken(request.headers) },
      { jobId, manifestHash: body.manifestHash, evidenceIds: body.evidenceIds },
    );
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: { code: error instanceof Error ? error.message : 'DSG_MANIFEST_FAILED' } },
      { status: 403 },
    );
  }
}
