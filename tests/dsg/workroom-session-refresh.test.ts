import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/refresh/route';

function request(cookie = '') {
  return new NextRequest('https://dsg.pics/api/auth/refresh', {
    method: 'POST', headers: cookie ? { cookie } : {},
  });
}

describe('DSG ONE Workroom silent session renewal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv('NEXT_PUBLIC_DSG_ONE_V1_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_DSG_ONE_V1_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
  });

  it('requires the existing HttpOnly refresh cookie and does not call provider otherwise', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ ok: false, error: 'DSG_REAUTH_REQUIRED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rotates both cookies securely without ever returning token values to JavaScript', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: 'access-token-new',
      refresh_token: 'refresh-token-new',
      expires_in: 3600,
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(request('sb-refresh-token=refresh-token-old; dsg-workspace-id=workspace-1'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.cookies.get('sb-access-token')?.value).toBe('access-token-new');
    expect(response.cookies.get('sb-refresh-token')?.value).toBe('refresh-token-new');
    const cookies = response.headers.getSetCookie().join(';');
    expect(cookies).toContain('HttpOnly');
    expect(cookies).toContain('Secure');
    expect(cookies).toContain('SameSite=lax');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://example.supabase.co/auth/v1/token?grant_type=refresh_token');
    expect(JSON.parse(options.body)).toEqual({ refresh_token: 'refresh-token-old' });
  });

  it('fails closed on invalid refresh credentials without leaking provider message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: 'invalid_grant', error_description: 'private provider diagnostic' }),
      { status: 400 },
    )));
    const response = await POST(request('sb-refresh-token=expired-token'));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ ok: false, error: 'DSG_REAUTH_REQUIRED' });
  });

  it('fails closed on partial rotation rather than leaving an inconsistent credential pair', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ access_token: 'access-only' }), { status: 200 },
    )));
    const response = await POST(request('sb-refresh-token=existing-token'));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: 'DSG_SESSION_ROTATION_UNVERIFIED' });
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('preserves the workspace/deep link and attempts renewal only after an explicit 401', () => {
    const source = readFileSync(join(process.cwd(), 'app/dsg/workroom/page.tsx'), 'utf8');
    expect(source).toContain('if (response.status === 401)');
    expect(source).toContain("fetch('/api/auth/refresh'");
    expect(source).toContain("method: 'POST', credentials: 'include', cache: 'no-store'");
    expect(source).toContain("window.location.assign('/login?next=' + encodeURIComponent(returnTo))");
  });
});
