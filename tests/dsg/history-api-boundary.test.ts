import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  config: vi.fn(),
  read: vi.fn(),
}));

vi.mock('@/lib/dsg/server/context', () => ({ requireVerifiedDsgActor: mocks.authorize }));
vi.mock('@/lib/dsg/server/supabase-rpc', () => ({
  getDsgSupabaseRpcConfig: mocks.config,
  readDsgRest: mocks.read,
}));

import { GET } from '@/app/api/dsg/history/route';

const get = (query = '', headers: Record<string, string> = {}) =>
  GET(new Request(`https://dsg.pics/api/dsg/history${query}`, { headers }));

const row = (n: number, status = 'deployed') => ({
  id: `id-${n}`, app_name: `App ${n}`, status, description: `change ${n}`,
  lines_added: n, lines_removed: 1, created_at: `2026-10-0${(n % 9) + 1}T10:00:00Z`,
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.authorize.mockResolvedValue({ actorId: 'user-a', workspaceId: 'ws-1', role: 'VIEWER' });
  mocks.config.mockReturnValue({ url: 'http://db.invalid', key: 'k' });
});

describe('/api/dsg/history', () => {
  it('requires job:read and scopes the query to the verified user, ignoring spoofed identity headers', async () => {
    mocks.read.mockResolvedValue([row(1)]);
    const res = await get('', { 'x-dsg-actor-id': 'someone-else', 'x-dsg-actor-role': 'OWNER' });
    expect(res.status).toBe(200);
    expect(mocks.authorize).toHaveBeenCalledWith(expect.any(Headers), 'job:read');
    const params = mocks.read.mock.calls[0][2] as Record<string, string>;
    expect(params.user_id).toBe('eq.user-a');
  });

  it('maps rows and pages them from the database result (no static data)', async () => {
    mocks.read.mockResolvedValue(Array.from({ length: 12 }, (_, i) => row(i + 1)));
    const body = await (await get('?page=2')).json();
    expect(body.data.total).toBe(12);
    expect(body.data.totalPages).toBe(2);
    expect(body.data.items.map((i: { appName: string }) => i.appName)).toEqual(['App 11', 'App 12']);
    expect(body.data.items[0].status).toBe('DEPLOYED');
  });

  it('answers 403 for auth/permission/context failures with the known code', async () => {
    for (const code of ['DSG_AUTH_REQUIRED', 'DSG_PERMISSION_DENIED', 'DSG_CONTEXT_REQUIRED']) {
      mocks.authorize.mockRejectedValueOnce(new Error(code));
      const res = await get();
      expect(res.status).toBe(403);
      expect((await res.json()).error.code).toBe(code);
    }
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it('never echoes raw database or configuration errors to the browser', async () => {
    for (const raw of [
      'invalid input syntax for type uuid: "demo-workspace"',
      'DSG_SUPABASE_URL_REQUIRED:DSG_ONE_V1_SUPABASE_URL|SUPABASE_URL',
      'relation "dsg_app_builds" does not exist',
    ]) {
      mocks.read.mockRejectedValueOnce(new Error(raw));
      const res = await get();
      const text = await res.text();
      expect(res.status).toBe(500);
      expect(JSON.parse(text).error.code).toBe('HISTORY_FETCH_FAILED');
      expect(text).not.toContain(raw.slice(0, 20));
    }
  });
});
