import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function noStore(data: Record<string, unknown>, status: number) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

function authConfig() {
  const url = process.env.NEXT_PUBLIC_DSG_ONE_V1_SUPABASE_URL ?? process.env.DSG_ONE_V1_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_DSG_ONE_V1_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ''), key };
}

// Rotate the existing DSG ONE Supabase session server-side. The client never sees tokens.
// This does not bypass Auth0 step-up or Spacetime per-action signed approval.
export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get('sb-refresh-token')?.value;
  if (!refreshToken) return noStore({ ok: false, error: 'DSG_REAUTH_REQUIRED' }, 401);
  const config = authConfig();
  if (!config) return noStore({ ok: false, error: 'DSG_AUTH_CONFIG_REQUIRED' }, 503);

  try {
    const upstream = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: config.key, 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: 'no-store',
    });
    if (!upstream.ok) {
      return upstream.status === 400 || upstream.status === 401
        ? noStore({ ok: false, error: 'DSG_REAUTH_REQUIRED' }, 401)
        : noStore({ ok: false, error: 'DSG_AUTH_PROVIDER_UNAVAILABLE' }, 503);
    }
    const payload = await upstream.json() as {
      access_token?: unknown; refresh_token?: unknown; expires_in?: unknown;
    };
    if (typeof payload.access_token !== 'string' || !payload.access_token ||
        typeof payload.refresh_token !== 'string' || !payload.refresh_token) {
      return noStore({ ok: false, error: 'DSG_SESSION_ROTATION_UNVERIFIED' }, 503);
    }

    const ttl = typeof payload.expires_in === 'number' && Number.isFinite(payload.expires_in)
      && payload.expires_in > 0 && payload.expires_in <= 86400
      ? Math.floor(payload.expires_in) : 3600;
    const response = noStore({ ok: true }, 200);
    response.cookies.set('sb-access-token', payload.access_token, {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: ttl,
    });
    response.cookies.set('sb-refresh-token', payload.refresh_token, {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch {
    return noStore({ ok: false, error: 'DSG_AUTH_PROVIDER_UNAVAILABLE' }, 503);
  }
}
