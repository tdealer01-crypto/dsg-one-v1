import { NextResponse } from 'next/server';
import { authorizeDsgRoute } from '@/lib/dsg/server/route-auth';
import { getDsgSupabaseRpcConfig, readDsgRest } from '@/lib/dsg/server/supabase-rpc';
import { RANGE_DAYS, parseRange, summarizeBuilds, type BuildRow } from '@/lib/dsg/analytics/summarize';

export const dynamic = 'force-dynamic';

// Upper bound on rows read for one summary; if it is hit the response says so instead of undercounting silently.
const ROW_LIMIT = 5000;
const DAY_MS = 86_400_000;

export async function GET(request: Request) {
  const auth = await authorizeDsgRoute(request.headers, 'job:read');
  if (!auth.ok) return auth.response;

  try {
    const range = parseRange(new URL(request.url).searchParams.get('range'));
    const now = Date.now();
    // Two windows: the selected one and the one before it, so a trend is a real comparison.
    const since = new Date(now - 2 * RANGE_DAYS[range] * DAY_MS).toISOString();

    const rows = await readDsgRest<BuildRow[]>(getDsgSupabaseRpcConfig(), 'dsg_app_builds', {
      user_id: `eq.${auth.actor.actorId}`,
      created_at: `gte.${since}`,
      select: 'id,app_name,status,created_at',
      order: 'created_at.desc',
      limit: String(ROW_LIMIT),
    });

    return NextResponse.json({
      ok: true,
      data: { ...summarizeBuilds(rows, range, now), generatedAt: new Date(now).toISOString(), truncated: rows.length >= ROW_LIMIT },
    });
  } catch {
    // Database/driver text stays server-side.
    return NextResponse.json({ ok: false, error: { code: 'ANALYTICS_FETCH_FAILED' } }, { status: 500 });
  }
}
