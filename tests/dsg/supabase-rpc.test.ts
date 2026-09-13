import { afterEach, describe, expect, it, vi } from 'vitest';

import { callDsgRpc, readDsgRest } from '../../lib/dsg/server/supabase-rpc';

describe('DSG Supabase REST/RPC auth headers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses modern sb_secret keys only as apikey when no user token is present', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await readDsgRest(
      { url: 'https://example.supabase.co', key: 'sb_secret_production' },
      'dsg_automation_runs',
      { limit: '1' },
    );

    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get('apikey')).toBe('sb_secret_production');
    expect(headers.get('authorization')).toBeNull();
    expect(headers.get('accept-profile')).toBe('public');
  });

  it('uses the user JWT as Authorization while keeping the server key in apikey', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await readDsgRest(
      { url: 'https://example.supabase.co', key: 'sb_secret_production', userAccessToken: 'user-jwt' },
      'dsg_automation_runs',
      { limit: '1' },
    );

    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get('apikey')).toBe('sb_secret_production');
    expect(headers.get('authorization')).toBe('Bearer user-jwt');
    expect(headers.get('accept-profile')).toBe('public');
  });

  it('keeps Bearer compatibility for legacy JWT-style server keys', async () => {
    const fetchMock = vi.fn(async () => new Response('"ok"', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await callDsgRpc(
      { url: 'https://example.supabase.co', key: 'legacy-service-role-jwt' },
      'dsg_test_rpc',
      {},
    );

    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get('apikey')).toBe('legacy-service-role-jwt');
    expect(headers.get('authorization')).toBe('Bearer legacy-service-role-jwt');
    expect(headers.get('content-profile')).toBe('public');
  });
});
