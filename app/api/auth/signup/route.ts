import { NextRequest, NextResponse } from 'next/server';

const EMAIL = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;

function authConfiguration() {
  const url = process.env.DSG_ONE_V1_SUPABASE_URL ?? process.env.NEXT_PUBLIC_DSG_ONE_V1_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_DSG_ONE_V1_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('DSG_AUTH_CONFIG_REQUIRED');
  return { url: url.replace(/\\/$/, ''), key };
}

export async function POST(request: NextRequest) {
  // Cookie-based sessions must not be used for cross-origin signup POSTs.
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ ok: false, error: 'ORIGIN_DENIED' }, { status: 403 });
  }

  let input: { email?: unknown; password?: unknown };
  try {
    input = await request.json() as typeof input;
  } catch {
    return NextResponse.json({ ok: false, error: 'INVALID_REQUEST' }, { status: 400 });
  }

  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  if (!EMAIL.test(email) || email.length > 254 || password.length < 12 || password.length > 128) {
    return NextResponse.json({ ok: false, error: 'INVALID_SIGNUP_INPUT' }, { status: 400 });
  }

  try {
    const { url, key } = authConfiguration();
    const upstream = await fetch(url + '/auth/v1/signup', {
      method: 'POST',
      headers: { apikey: key, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    if (upstream.status === 429) {
      return NextResponse.json({ ok: false, error: 'RATE_LIMITED' }, { status: 429 });
    }
    if (!upstream.ok) {
      // Do not leak whether a real account exists or return raw upstream errors.
      return NextResponse.json({ ok: false, error: 'SIGNUP_NOT_ACCEPTED' }, { status: 400 });
    }
    // Signup never grants workspace membership, AppDeploy access or runtime permissions.
    return NextResponse.json(
      { ok: true, status: 'SIGNUP_SUBMITTED', next: '/login?next=/try', accessGranted: false },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ ok: false, error: 'SIGNUP_BACKEND_UNAVAILABLE' }, { status: 503 });
  }
}
