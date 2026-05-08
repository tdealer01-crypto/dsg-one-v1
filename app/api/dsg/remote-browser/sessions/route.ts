import { NextResponse } from 'next/server';
import { createRemoteBrowserSession, listRemoteBrowserSessions } from '@/lib/dsg/remote-browser/session-store';
import type { RemoteBrowserCreateSessionInput } from '@/lib/dsg/remote-browser/types';

export async function GET() {
  return NextResponse.json({ ok: true, data: { sessions: listRemoteBrowserSessions() } });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as Partial<RemoteBrowserCreateSessionInput> | null;
  const goal = typeof body?.goal === 'string' ? body.goal.trim() : '';
  const startUrl = typeof body?.startUrl === 'string' ? body.startUrl.trim() : '';
  const providerId = body?.providerId;

  if (!goal) return NextResponse.json({ ok: false, error: { message: 'REMOTE_BROWSER_GOAL_REQUIRED' } }, { status: 400 });
  if (!startUrl) return NextResponse.json({ ok: false, error: { message: 'REMOTE_BROWSER_START_URL_REQUIRED' } }, { status: 400 });

  try {
    const session = createRemoteBrowserSession({ goal, startUrl, providerId });
    return NextResponse.json({ ok: true, data: { session } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: { message: error instanceof Error ? error.message : 'REMOTE_BROWSER_SESSION_CREATE_FAILED' } }, { status: 400 });
  }
}
