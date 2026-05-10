import { NextResponse } from 'next/server';
import { requireVerifiedDsgActor } from '@/lib/dsg/server/context';

const allowedBackgrounds = new Set(['bg-slate-900', 'bg-red-600', 'bg-blue-600', 'bg-emerald-600', 'bg-purple-600', 'bg-orange-600']);

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export async function POST(req: Request) {
  try {
    await requireVerifiedDsgActor(req.headers, 'job:control');
    const body = asRecord(await req.json().catch(() => null));
    const requestedBg = typeof body.headerBg === 'string' ? body.headerBg : 'bg-slate-900';
    const headerBg = allowedBackgrounds.has(requestedBg) ? requestedBg : 'bg-slate-900';
    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 80) : 'DSG Flow Studio';

    return NextResponse.json({
      ok: true,
      data: {
        mode: 'dry_run_only',
        config: { headerBg, title },
        writePerformed: false,
        nextAction: 'Review the patch and commit a normal source change if this theme should become permanent.',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'FLOW_STUDIO_MUTATE_FAILED';
    return NextResponse.json({ ok: false, error: { code: message, message } }, { status: message.startsWith('DSG_') ? 401 : 400 });
  }
}
