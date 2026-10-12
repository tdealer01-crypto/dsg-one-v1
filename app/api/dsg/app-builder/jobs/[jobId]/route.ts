import { NextResponse } from 'next/server';
import { getAppBuilderRequestContext } from '@/lib/dsg/server/app-builder/context';
import { getAppBuilderJob } from '@/lib/dsg/server/app-builder/repository';
import { classifyAppBuilderJobError } from '@/lib/dsg/server/app-builder/job-error';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await context.params;
    // Do not feed unchecked filter expressions into Supabase PostgREST queries.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)) {
      return NextResponse.json({ ok: false, error: { code: 'INVALID_JOB_ID' } }, {
        status: 400,
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }
    const actor = await getAppBuilderRequestContext(req, 'job:read');
    // Repository scopes every lookup to actor.workspaceId; no cross-tenant fallback.
    const job = await getAppBuilderJob(actor, jobId);
    return NextResponse.json({ ok: true, data: job }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    const { code, status } = classifyAppBuilderJobError(error);
    return NextResponse.json({ ok: false, error: { code } }, {
      status,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }
}
