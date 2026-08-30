export const DSG_LIFECYCLE_EVENTS = [
  'dsg_signup',
  'verification_started',
  'plan_created',
  'plan_approved',
  'preflight_allow',
  'preflight_waiting_permission',
  'preflight_block',
  'proof_created',
  'proof_viewed',
  'mcp_connected',
  'external_action_verified',
] as const;

export type DsgLifecycleEvent = (typeof DSG_LIFECYCLE_EVENTS)[number];

export type LifecycleEmitResult =
  | { ok: true; delivered: true; provider: 'activecampaign' }
  | { ok: true; delivered: false; provider: 'activecampaign'; reason: 'NOT_CONFIGURED' }
  | { ok: false; delivered: false; provider: 'activecampaign'; reason: string };

function isAllowedEvent(value: string): value is DsgLifecycleEvent {
  return (DSG_LIFECYCLE_EVENTS as readonly string[]).includes(value);
}

export async function emitLifecycleEvent(input: {
  event: DsgLifecycleEvent;
  email: string;
  data?: Record<string, string | number | boolean | null | undefined>;
  env?: NodeJS.ProcessEnv;
}): Promise<LifecycleEmitResult> {
  if (!isAllowedEvent(input.event)) {
    return { ok: false, delivered: false, provider: 'activecampaign', reason: 'EVENT_NOT_ALLOWED' };
  }

  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return { ok: false, delivered: false, provider: 'activecampaign', reason: 'EMAIL_REQUIRED' };
  }

  const env = input.env ?? process.env;
  const actid = env.ACTIVECAMPAIGN_ACTID?.trim();
  const key = env.ACTIVECAMPAIGN_EVENT_KEY?.trim();
  if (!actid || !key) {
    return { ok: true, delivered: false, provider: 'activecampaign', reason: 'NOT_CONFIGURED' };
  }

  const safeData = Object.fromEntries(
    Object.entries(input.data ?? {}).filter(([, value]) => value !== undefined),
  );

  const body = new URLSearchParams({
    actid,
    key,
    event: input.event,
    eventdata: JSON.stringify(safeData),
    visit: JSON.stringify({ email }),
  });

  try {
    const response = await fetch('https://trackcmp.net/event', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        ok: false,
        delivered: false,
        provider: 'activecampaign',
        reason: `HTTP_${response.status}`,
      };
    }

    const payload = (await response.json().catch(() => null)) as { success?: number } | null;
    if (payload?.success !== 1) {
      return { ok: false, delivered: false, provider: 'activecampaign', reason: 'PROVIDER_REJECTED' };
    }

    return { ok: true, delivered: true, provider: 'activecampaign' };
  } catch {
    return { ok: false, delivered: false, provider: 'activecampaign', reason: 'PROVIDER_UNREACHABLE' };
  }
}
