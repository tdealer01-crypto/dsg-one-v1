import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as signup } from '@/app/api/auth/signup/route';
import { POST as pilotRequest } from '@/app/api/dsg/pilot/request/route';

const origin = 'https://dsg.pics';
const request = (path: string, body: object, cookie = '') => new NextRequest(origin + path, {
  method: 'POST',
  headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
  body: JSON.stringify(body),
});

describe('DSG ONE v1 pilot enrollment — never execution authority', () => {
  beforeEach(() => {
    vi.stubEnv('DSG_ONE_V1_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_DSG_ONE_V1_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
    vi.stubEnv('DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY', 'sb_secret_test');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('signup creates only an Auth request and never adds member privileges', async () => {
    const upstream = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', upstream);
    const response = await signup(request('/api/auth/signup', { email: 'pilot@example.test', password: 'long-test-password' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'SIGNUP_SUBMITTED', accessGranted: false });
    expect(upstream).toHaveBeenCalledTimes(1);
    expect(String(upstream.mock.calls[0][0])).toMatch(/\/auth\/v1\/signup$/);
    expect(JSON.stringify(upstream.mock.calls[0][1])).not.toMatch(/service_role|workspace_members|OWNER/);
  });

  it('rejects an anonymous pilot request before touching private Supabase tables', async () => {
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);
    const response = await pilotRequest(request('/api/dsg/pilot/request', { workspaceName: 'Test Organization' }));
    expect(response.status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('rejects unconfirmed Auth identity', async () => {
    const upstream = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'actor', email: 'pilot@example.test', email_confirmed_at: null }), { status: 200 }),
    );
    vi.stubGlobal('fetch', upstream);
    const response = await pilotRequest(request('/api/dsg/pilot/request', { workspaceName: 'Test Organization' }, 'sb-access-token=token'));
    expect(response.status).toBe(401);
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it('returns a pending-only result for an existing request without inserting duplicates', async () => {
    const upstream = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'actor', email: 'pilot@example.test', email_confirmed_at: '2026-10-24' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 'trial1', status: 'pending' }]), { status: 200 }));
    vi.stubGlobal('fetch', upstream);
    const response = await pilotRequest(request('/api/dsg/pilot/request', { workspaceName: 'Test Organization' }, 'sb-access-token=token'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'PENDING_REVIEW', accessGranted: false });
    expect(upstream).toHaveBeenCalledTimes(2);
  });

  it('writes to existing trial_signups with status pending; never grants workspace or AppDeploy roles', async () => {
    const upstream = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'actor', email: 'pilot@example.test', email_confirmed_at: '2026-10-24' }), { status: 200 }))
      .mockResolvedValueOnce(new Response('[]', { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 201 }));
    vi.stubGlobal('fetch', upstream);
    const response = await pilotRequest(request('/api/dsg/pilot/request', { workspaceName: 'Test Organization' }, 'sb-access-token=token'));
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ accessGranted: false });
    expect(upstream).toHaveBeenCalledTimes(3);
    expect(String(upstream.mock.calls[2][0])).toContain('/rest/v1/trial_signups');
    const inserted = JSON.parse((upstream.mock.calls[2][1] as RequestInit).body as string);
    expect(inserted).toMatchObject({ email: 'pilot@example.test', status: 'pending' });
    expect(inserted).not.toHaveProperty('role');
    expect(inserted).not.toHaveProperty('workspace_id');
  });

  it('blocks cross-origin signup and enrollment before hitting Supabase', async () => {
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);
    const malformed = new NextRequest(origin + '/api/auth/signup', {
      method: 'POST', headers: { Origin: 'https://example.attacker.test' },
      body: JSON.stringify({ email: 'pilot@example.test', password: 'long-test-password' }),
    });
    expect((await signup(malformed)).status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });
});