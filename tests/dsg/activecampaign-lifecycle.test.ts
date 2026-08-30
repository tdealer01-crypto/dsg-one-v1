import { afterEach, describe, expect, it, vi } from 'vitest';
import { emitLifecycleEvent } from '../../lib/dsg/lifecycle/activecampaign';

afterEach(() => {
  vi.unstubAllGlobals();
});

const configuredEnv = {
  ACTIVECAMPAIGN_API_URL: 'https://example.api-us1.com',
  ACTIVECAMPAIGN_API_TOKEN: 'api-secret',
  ACTIVECAMPAIGN_TAG_VERIFICATION_STARTED_ID: '12',
  ACTIVECAMPAIGN_TAG_PROOF_CREATED_ID: '13',
  ACTIVECAMPAIGN_TAG_PROOF_VIEWED_ID: '14',
};

describe('ActiveCampaign lifecycle adapter', () => {
  it('degrades safely when v3 tag lifecycle is not configured', async () => {
    const result = await emitLifecycleEvent({
      event: 'proof_created',
      email: 'user@example.com',
      data: { proof_hash: 'a'.repeat(64) },
      env: {},
    });

    expect(result).toEqual({
      ok: true,
      delivered: false,
      provider: 'activecampaign',
      reason: 'NOT_CONFIGURED',
    });
  });

  it('finds the existing contact and applies the lifecycle tag', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      expect(new Headers(init?.headers).get('Api-Token')).toBe('api-secret');

      if (url.includes('/api/3/contacts?email=')) {
        expect(url).toContain('user%40example.com');
        return new Response(JSON.stringify({ contacts: [{ id: '2', email: 'user@example.com' }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.endsWith('/api/3/contacts/2/contactTags')) {
        return new Response(JSON.stringify({ contactTags: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.endsWith('/api/3/contactTags')) {
        expect(init?.method).toBe('POST');
        expect(JSON.parse(String(init?.body))).toEqual({
          contactTag: { contact: '2', tag: '13' },
        });
        return new Response(JSON.stringify({ contactTag: { id: '99', contact: '2', tag: '13' } }), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        });
      }
      throw new Error(`unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await emitLifecycleEvent({
      event: 'proof_created',
      email: 'USER@EXAMPLE.COM',
      data: { proof_hash: 'b'.repeat(64), runtime_gate: 'BLOCKED' },
      env: configuredEnv,
    });

    expect(result).toEqual({ ok: true, delivered: true, provider: 'activecampaign' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('is idempotent when the lifecycle tag is already present', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/api/3/contacts?email=')) {
        return new Response(JSON.stringify({ contacts: [{ id: '2', email: 'user@example.com' }] }), { status: 200 });
      }
      if (url.endsWith('/api/3/contacts/2/contactTags')) {
        return new Response(JSON.stringify({ contactTags: [{ tag: '14' }] }), { status: 200 });
      }
      throw new Error(`unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await emitLifecycleEvent({
      event: 'proof_viewed',
      email: 'user@example.com',
      env: configuredEnv,
    });

    expect(result).toEqual({
      ok: true,
      delivered: false,
      provider: 'activecampaign',
      reason: 'ALREADY_DELIVERED',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not create an unknown contact', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ contacts: [] }), { status: 200 })));

    const result = await emitLifecycleEvent({
      event: 'verification_started',
      email: 'unknown@example.com',
      env: configuredEnv,
    });

    expect(result).toEqual({
      ok: true,
      delivered: false,
      provider: 'activecampaign',
      reason: 'CONTACT_NOT_FOUND',
    });
  });

  it('reports provider failure without producing a success delivery', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('no', { status: 503 })));

    const result = await emitLifecycleEvent({
      event: 'proof_viewed',
      email: 'user@example.com',
      env: configuredEnv,
    });

    expect(result).toEqual({
      ok: false,
      delivered: false,
      provider: 'activecampaign',
      reason: 'CONTACT_LOOKUP_HTTP_503',
    });
  });
});
