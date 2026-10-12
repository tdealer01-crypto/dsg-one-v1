import { NextResponse } from 'next/server';
import {
  DSG_LIFECYCLE_EVENTS,
  emitLifecycleEvent,
  type DsgLifecycleEvent,
} from '@/lib/dsg/lifecycle/activecampaign';
import { authorizeDsgUser } from '@/lib/dsg/server/route-auth';

function isAllowedEvent(value: unknown): value is DsgLifecycleEvent {
  return typeof value === 'string' && (DSG_LIFECYCLE_EVENTS as readonly string[]).includes(value);
}

export async function POST(req: Request) {
  // Tags a CRM contact with the server's ActiveCampaign token: identity first, and only for the caller's own email.
  const auth = await authorizeDsgUser(req.headers);
  if (!auth.ok) return auth.response;

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

  const email = body.email.trim().toLowerCase();
  if (!auth.user.email || email !== auth.user.email) {
    return NextResponse.json({
      ok: true,
      status: 'NOT_RECORDED',
      event: body.event,
      delivery: { ok: true, delivered: false, provider: 'activecampaign', reason: 'EMAIL_NOT_ACCOUNT_EMAIL' },
    });
  }

  const emitted = await emitLifecycleEvent({ event: body.event, email, data });
  // Do not turn this endpoint into a way to learn which addresses exist in the CRM.
  const delivery = emitted.ok && !emitted.delivered && emitted.reason === 'CONTACT_NOT_FOUND'
    ? { ...emitted, reason: 'NOT_DELIVERED' }
    : emitted;

  // Lifecycle delivery is deliberately non-authoritative. It can report failure,
  // but it never rewrites a DSG governance/proof decision.
  return NextResponse.json({ ok: true, status: 'RECORDED', event: body.event, delivery });
}
