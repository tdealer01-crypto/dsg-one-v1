import { NextRequest, NextResponse } from 'next/server';

function getAuthConfig() {
  const url = process.env.NEXT_PUBLIC_DSG_ONE_V1_SUPABASE_URL ?? process.env.DSG_ONE_V1_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_DSG_ONE_V1_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('DSG_AUTH_CONFIG_REQUIRED');
  return { url: url.replace(/\/$/, ''), key };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { email?: string; password?: string };
    if (!body.email || !body.password) {
      return NextResponse.json({ ok: false, error: 'EMAIL_PASSWORD_REQUIRED' }, { status: 400 });
    }

    const config = getAuthConfig();
    const upstream = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ email: body.email, password: body.password }),
      cache: 'no-store',
    });

    const payload = await upstream.json() as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error_description?: string;
      msg?: string;
    };

    if (!upstream.ok || !payload.access_token) {
      return NextResponse.json({ ok: false, error: payload.error_description ?? payload.msg ?? 'SIGN_IN_FAILED' }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set('sb-access-token', payload.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: payload.expires_in ?? 3600,
    });
    if (payload.refresh_token) {
      response.cookies.set('sb-refresh-token', payload.refresh_token, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    return response;
  } catch (error) {
    const code = error instanceof Error ? error.message : 'SIGN_IN_FAILED';
    return NextResponse.json({ ok: false, error: code }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  for (const name of ['sb-access-token', 'sb-refresh-token', 'dsg-workspace-id']) {
    response.cookies.set(name, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
  }
  return response;
}
