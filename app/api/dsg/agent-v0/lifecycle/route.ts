import { NextResponse } from 'next/server';
import { requireVerifiedDsgActor } from '@/lib/dsg/server/context';
import { callKaggleOwnerBridge } from '@/lib/dsg/server/kaggle-owner-ssm-bridge';

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
    return json(reason === 'DSG_AUTH_REQUIRED' ? 401 : 403, { ok: false, error: 'DSG_VERIFIED_OWNER_REQUIRED' });
  }
  // Live GitHub workflow data is controller telemetry, NEVER Kaggle GPU
  // health, quota or proof of shutdown. No token is present in the response.
  const result = await callKaggleOwnerBridge('status');
  return json(result.ok ? 200 : 503, result);
}

export async function POST() {
  return json(405, { ok: false, error: 'KAGGLE_OWNER_START_REQUIRES_SIGNED_WORKROOM_REQUEST' });
}
