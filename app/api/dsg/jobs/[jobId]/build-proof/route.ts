import { NextResponse } from 'next/server';
import { requireVerifiedDsgActor } from '@/lib/dsg/server/context';

export async function POST(request: Request) {
  await requireVerifiedDsgActor(request.headers, 'job:control');

  return NextResponse.json(
    {
      ok: false,
      error: {
        code: 'DSG_BUILD_PROOF_CALLBACK_NOT_WIRED',
        message: 'Build proof must come from CI artifact/callback, not client-supplied body.ok.',
      },
    },
    { status: 501 },
  );
}
