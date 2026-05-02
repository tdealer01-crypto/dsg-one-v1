import { NextResponse } from 'next/server';
import { assertDsgPermission, devHeaderActor } from '@/lib/dsg/server/context';

export async function GET(request: Request) {
  const actor = assertDsgPermission(devHeaderActor(request.headers), 'job:read');
  return NextResponse.json({ ok: true, data: { actor, jobs: [], source: 'database-required' } });
}

export async function POST(request: Request) {
  const actor = assertDsgPermission(devHeaderActor(request.headers), 'job:create');
  const body = (await request.json().catch(() => null)) as { goal?: string } | null;
  if (!body?.goal?.trim()) {
    return NextResponse.json({ ok: false, error: { code: 'DSG_GOAL_REQUIRED' } }, { status: 400 });
  }
  return NextResponse.json(
    { ok: false, error: { code: 'DSG_REPOSITORY_NOT_CONNECTED', actor } },
    { status: 501 },
  );
}
