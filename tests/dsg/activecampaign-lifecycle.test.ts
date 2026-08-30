import { afterEach, describe, expect, it, vi } from 'vitest';
import { emitLifecycleEvent } from '../../lib/dsg/lifecycle/activecampaign';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ActiveCampaign lifecycle adapter', () => {
  it('degrades safely when event tracking is not configured', async () => {
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

  it('sends only the whitelisted lifecycle event and contact identity', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const params = new URLSearchParams(String(init?.body));
      expect(params.get('actid')).toBe('123456789');
      expect(params.get('key')).toBe('event-secret');
      expect(params.get('event')).toBe('proof_created');
      expect(params.get('visit')).toBe(JSON.stringify({ email: 'user@example.com' }));
      expect(JSON.parse(params.get('eventdata') ?? '{}')).toEqual({
        proof_hash: 'b'.repeat(64),
        runtime_gate: 'BLOCKED',
      });
      return new Response(JSON.stringify({ success: 1, message: 'Event spawned' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await emitLifecycleEvent({
      event: 'proof_created',
      email: 'USER@EXAMPLE.COM',
      data: { proof_hash: 'b'.repeat(64), runtime_gate: 'BLOCKED' },
      env: {
        ACTIVECAMPAIGN_ACTID: '123456789',
        ACTIVECAMPAIGN_EVENT_KEY: 'event-secret',
      },
    });

    expect(result).toEqual({ ok: true, delivered: true, provider: 'activecampaign' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports provider failure without producing a success delivery', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('no', { status: 503 })));

    const result = await emitLifecycleEvent({
      event: 'proof_viewed',
      email: 'user@example.com',
      env: {
        ACTIVECAMPAIGN_ACTID: '123456789',
        ACTIVECAMPAIGN_EVENT_KEY: 'event-secret',
      },
    });

    expect(result).toEqual({
      ok: false,
      delivered: false,
      provider: 'activecampaign',
      reason: 'HTTP_503',
    });
  });
});
