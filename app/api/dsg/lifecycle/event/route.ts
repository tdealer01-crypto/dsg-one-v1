import { NextResponse } from 'next/server';
import {
  DSG_LIFECYCLE_EVENTS,
  emitLifecycleEvent,
  type DsgLifecycleEvent,
} from '@/lib/dsg/lifecycle/activecampaign';

function isAllowedEvent(value: unknown): value is DsgLifecycleEvent {
  return typeof value === 'string' && (DSG_LIFECYCLE_EVENTS as readonly string[]).includes(value);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as {
    event?: unknown;
    email?: unknown;
    data?: unknown;
  } | null;

  if (!body || !isAllowedEvent(body.event) || typeof body.email !== 'string') {
    return NextResponse.json(
      { ok: false, status: 'BLOCK', error: { code: 'INVALID_LIFECYCLE_EVENT' } },
      { status: 400 },
    );
  }

  const data = body.data && typeof body.data === 'object' && !Array.isArray(body.data)
    ? body.data as Record<string, string | number | boolean | null | undefined>
    : undefined;

  const delivery = await emitLifecycleEvent({ event: body.event, email: body.email, data });

  // Lifecycle delivery is deliberately non-authoritative. It can report failure,
  // but it never rewrites a DSG governance/proof decision.
  return NextResponse.json({ ok: true, status: 'RECORDED', event: body.event, delivery });
}
