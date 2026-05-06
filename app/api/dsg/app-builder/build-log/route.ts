import { NextResponse } from 'next/server';
import { analyzeBuildLog } from '@/lib/dsg/app-builder/agent-runtime/build-log-analyzer';
import { getDevAppBuilderContext } from '@/lib/dsg/server/app-builder/context';
import { recordAppBuilderToolAudit } from '@/lib/dsg/server/app-builder/repository';

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : 'BUILD_LOG_ANALYZE_FAILED';
  return NextResponse.json({ ok: false, error: { code: message, message } }, { status: 400 });
}

export async function POST(req: Request) {
  try {
    const body = asRecord(await req.json().catch(() => null));
    const log = String(body.log || '');
    const jobId = String(body.jobId || 'build-log-analysis');
    const analysis = analyzeBuildLog(log);
    const ctx = getDevAppBuilderContext(req);

    await recordAppBuilderToolAudit({
      ctx,
      jobId,
      toolName: 'dsg.app_builder.build_log_analyze',
      outcome: analysis.status,
      evidenceRefs: [analysis.hash],
      auditEvent: analysis,
    }).catch(() => null);

    return NextResponse.json({ ok: true, jobId, analysis });
  } catch (error) {
    return fail(error);
  }
}
