import { NextResponse } from 'next/server';
import { requireVerifiedDsgActor } from '@/lib/dsg/server/context';
import { runKaggleSsmBridge } from '@/lib/dsg/server/kaggle-ssm-bridge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(status: number, data: Record<string, unknown>) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export async function GET(request: Request) {
  try {
    const actor = await requireVerifiedDsgActor(request.headers, 'job:read');
    if (actor.role !== 'OWNER') return json(403, { ok: false, error: 'KAGGLE_OWNER_REQUIRED' });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'DSG_AUTH_FAILED';
    return json(reason === 'DSG_AUTH_REQUIRED' ? 401 : 403, { ok: false, error: reason });
  }

  // Actual owner credential is an AWS SSM SecureString, not a container
  // environment variable. This observes only GitHub workflow metadata;
  // never infer Kaggle GPU readiness or shutdown from the workflow verdict.
  const result = await runKaggleSsmBridge('status');
  const { httpStatus, ...safeResult } = result;
  return json(httpStatus, safeResult);
}

export async function POST() {
  return json(405, { ok: false, error: 'KAGGLE_USE_SIGNED_OWNER_LAUNCH_ROUTE' });
}
