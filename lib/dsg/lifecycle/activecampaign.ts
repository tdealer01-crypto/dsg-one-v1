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

type LifecycleEnv = Readonly<Record<string, string | undefined>>;

export type LifecycleEmitResult =
  | { ok: true; delivered: true; provider: 'activecampaign' }
  | { ok: true; delivered: false; provider: 'activecampaign'; reason: 'NOT_CONFIGURED' | 'CONTACT_NOT_FOUND' | 'ALREADY_DELIVERED' }
  | { ok: false; delivered: false; provider: 'activecampaign'; reason: string };

const TAG_ENV_BY_EVENT: Partial<Record<DsgLifecycleEvent, string>> = {
  verification_started: 'ACTIVECAMPAIGN_TAG_VERIFICATION_STARTED_ID',
  proof_created: 'ACTIVECAMPAIGN_TAG_PROOF_CREATED_ID',
  proof_viewed: 'ACTIVECAMPAIGN_TAG_PROOF_VIEWED_ID',
};

function isAllowedEvent(value: string): value is DsgLifecycleEvent {
  return (DSG_LIFECYCLE_EVENTS as readonly string[]).includes(value);
}

function activeCampaignApiBase(raw: string): string {
  return raw.trim().replace(/\/+$/, '').replace(/\/api\/3$/i, '');
}

export async function emitLifecycleEvent(input: {
  event: DsgLifecycleEvent;
  email: string;
  data?: Record<string, string | number | boolean | null | undefined>;
  env?: LifecycleEnv;
}): Promise<LifecycleEmitResult> {
  if (!isAllowedEvent(input.event)) {
    return { ok: false, delivered: false, provider: 'activecampaign', reason: 'EVENT_NOT_ALLOWED' };
  }

  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return { ok: false, delivered: false, provider: 'activecampaign', reason: 'EMAIL_REQUIRED' };
  }

  const env: LifecycleEnv = input.env ?? process.env;
  const apiUrl = env.ACTIVECAMPAIGN_API_URL?.trim();
  const apiToken = env.ACTIVECAMPAIGN_API_TOKEN?.trim();
  const tagEnvName = TAG_ENV_BY_EVENT[input.event];
  const tagId = tagEnvName ? env[tagEnvName]?.trim() : undefined;
  if (!apiUrl || !apiToken || !tagEnvName || !tagId) {
    return { ok: true, delivered: false, provider: 'activecampaign', reason: 'NOT_CONFIGURED' };
  }

  const base = activeCampaignApiBase(apiUrl);
  const headers = {
    'Api-Token': apiToken,
    accept: 'application/json',
  };

  try {
    const contactResponse = await fetch(
      `${base}/api/3/contacts?email=${encodeURIComponent(email)}&limit=2`,
      { headers, cache: 'no-store' },
    );
    if (!contactResponse.ok) {
      return {
        ok: false,
        delivered: false,
        provider: 'activecampaign',
        reason: `CONTACT_LOOKUP_HTTP_${contactResponse.status}`,
      };
    }

    const contactPayload = (await contactResponse.json().catch(() => null)) as
      | { contacts?: Array<{ id?: string; email?: string }> }
      | null;
    const contact = contactPayload?.contacts?.find(
      (candidate) => candidate.email?.trim().toLowerCase() === email && candidate.id,
    );
    if (!contact?.id) {
      return { ok: true, delivered: false, provider: 'activecampaign', reason: 'CONTACT_NOT_FOUND' };
    }

    const existingTagsResponse = await fetch(
      `${base}/api/3/contacts/${encodeURIComponent(contact.id)}/contactTags`,
      { headers, cache: 'no-store' },
    );
    if (!existingTagsResponse.ok) {
      return {
        ok: false,
        delivered: false,
        provider: 'activecampaign',
        reason: `TAG_LOOKUP_HTTP_${existingTagsResponse.status}`,
      };
    }
    const existingTagsPayload = (await existingTagsResponse.json().catch(() => null)) as
      | { contactTags?: Array<{ tag?: string }> }
      | null;
    if (existingTagsPayload?.contactTags?.some((record) => String(record.tag) === tagId)) {
      return { ok: true, delivered: false, provider: 'activecampaign', reason: 'ALREADY_DELIVERED' };
    }

    const tagResponse = await fetch(`${base}/api/3/contactTags`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ contactTag: { contact: contact.id, tag: tagId } }),
      cache: 'no-store',
    });
    if (!tagResponse.ok) {
      return {
        ok: false,
        delivered: false,
        provider: 'activecampaign',
        reason: `TAG_ADD_HTTP_${tagResponse.status}`,
      };
    }

    return { ok: true, delivered: true, provider: 'activecampaign' };
  } catch {
    return { ok: false, delivered: false, provider: 'activecampaign', reason: 'PROVIDER_UNREACHABLE' };
  }
}
