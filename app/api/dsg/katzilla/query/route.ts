import { NextResponse } from 'next/server';
import { getKatzillaStatus, queryKatzilla } from '@/lib/dsg/connectors/katzilla';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type KatzillaQueryBody = {
  path?: unknown;
  params?: unknown;
};

function sanitizeParams(value: unknown): Record<string, string | number | boolean | null | undefined> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out: Record<string, string | number | boolean | null | undefined> = {};
  for (const [key, item] of Object.entries(value)) {
    if (['string', 'number', 'boolean'].includes(typeof item) || item === null || item === undefined) {
      out[key] = item as string | number | boolean | null | undefined;
    }
  }
  return out;
}

export async function POST(request: Request) {
  try {
    const status = getKatzillaStatus();
    if (!status.configured) {
      return NextResponse.json(
        { ok: false, error: 'KATZILLA_API_KEY_REQUIRED', status },
        { status: 503 },
      );
    }

    const body = (await request.json()) as KatzillaQueryBody;
    const path = typeof body.path === 'string' ? body.path : '';
    const params = sanitizeParams(body.params);

    const result = await queryKatzilla({ path, params });
    return NextResponse.json({ ok: result.ok, data: result, connector: status }, { status: result.ok ? 200 : result.status });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'KATZILLA_QUERY_FAILED' },
      { status: 500 },
    );
  }
}
