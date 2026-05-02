import { NextResponse } from 'next/server';
import { assertDsgPermission, devHeaderActor } from '@/lib/dsg/server/context';
import { createAuditExport } from '@/lib/dsg/server/repository';
import { getBearerToken } from '@/lib/dsg/server/supabase-rpc';

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const actor = assertDsgPermission(devHeaderActor(request.headers), 'audit:export');
  const { jobId } = await context.params;
  const body = (await request.json().catch(() => null)) as { exportHash?: string } | null;
  if (!body?.exportHash) {
    return NextResponse.json({ ok: false, error: { code: 'DSG_AUDIT_EXPORT_REQUIRED' } }, { status: 400 });
  }

  try {
    const data = await createAuditExport(
      { workspaceId: actor.workspaceId, actorId: actor.actorId, userAccessToken: getBearerToken(request.headers) },
      { jobId, exportHash: body.exportHash },
    );
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: { code: error instanceof Error ? error.message : 'DSG_AUDIT_EXPORT_FAILED' } },
      { status: 403 },
    );
  }
}
