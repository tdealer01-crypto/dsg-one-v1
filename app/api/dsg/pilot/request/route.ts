import { NextRequest, NextResponse } from 'next/server';

type AuthUser = { id?: string; email?: string; email_confirmed_at?: string | null };
type Trial = { id: string; status: string };

function config() {
  const url = process.env.DSG_ONE_V1_SUPABASE_URL ?? process.env.NEXT_PUBLIC_DSG_ONE_V1_SUPABASE_URL;
  const publishable = process.env.NEXT_PUBLIC_DSG_ONE_V1_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publishable || !serviceKey) throw new Error('PILOT_NOT_CONFIGURED');
  return { url: url.replace(/\/$/, ''), publishable, serviceKey };
}

async function memberFromCookie(request: NextRequest, url: string, publishable: string) {
  const token = request.cookies.get('sb-access-token')?.value;
  if (!token) return null;
  const response = await fetch(url + '/auth/v1/user', {
    headers: { apikey: publishable, Authorization: 'Bearer ' + token },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  const user = await response.json() as AuthUser;
  if (!user.id || !user.email || !user.email_confirmed_at) return null;
  return user;
}

function privilegedHeaders(key: string) {
  return {
    apikey: key,
    ...(key.startsWith('sb_') ? {} : { Authorization: 'Bearer ' + key }),
    Accept: 'application/json',
  };
}

async function existingPending(url: string, key: string, email: string): Promise<boolean> {
  const query = new URL(url + '/rest/v1/trial_signups');
  query.searchParams.set('email', 'eq.' + email);
  query.searchParams.set('status', 'eq.pending');
  query.searchParams.set('select', 'id,status');
  query.searchParams.set('limit', '1');
  const response = await fetch(query, {
    headers: privilegedHeaders(key),
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('TRIAL_QUERY_FAILED');
  const rows = await response.json() as Trial[];
  return Array.isArray(rows) && rows.length > 0;
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ ok: false, error: 'ORIGIN_DENIED' }, { status: 403 });
  }

  let body: { workspaceName?: unknown; fullName?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'INVALID_REQUEST' }, { status: 400 });
  }
  const workspaceName = typeof body.workspaceName === 'string' ? body.workspaceName.trim() : '';
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
  if (workspaceName.length < 2 || workspaceName.length > 100 || fullName.length > 100) {
    return NextResponse.json({ ok: false, error: 'INVALID_PILOT_REQUEST' }, { status: 400 });
  }

  try {
    const { url, publishable, serviceKey } = config();
    const user = await memberFromCookie(request, url, publishable);
    if (!user) return NextResponse.json({ ok: false, error: 'VERIFIED_SIGN_IN_REQUIRED' }, { status: 401 });
    const email = user.email!.trim().toLowerCase();
    if (await existingPending(url, serviceKey, email)) {
      return NextResponse.json({ ok: true, status: 'PENDING_REVIEW', accessGranted: false });
    }

    const response = await fetch(url + '/rest/v1/trial_signups', {
      method: 'POST',
      headers: {
        ...privilegedHeaders(serviceKey),
        'content-type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        email,
        workspace_name: workspaceName,
        full_name: fullName || null,
        status: 'pending',
        ref_code: 'LOUNGE_PILOT',
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('TRIAL_INSERT_FAILED');
    // This is an enrollment request, never an execution permit or role assignment.
    return NextResponse.json(
      { ok: true, status: 'PENDING_REVIEW', accessGranted: false },
      { status: 202, headers: { 'cache-control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ ok: false, error: 'PILOT_BACKEND_UNAVAILABLE' }, { status: 503 });
  }
}