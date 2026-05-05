import { NextResponse } from 'next/server';
import { requireVerifiedDsgActor } from '@/lib/dsg/server/context';

export async function POST(request: Request) {
  await requireVerifiedDsgActor(request.headers, 'production:write');

  return NextResponse.json(
    {
      ok: false,
      error: {
        code: 'DSG_AUTH_RBAC_PROOF_CALLBACK_NOT_WIRED',
        message: 'Auth/RBAC proof must come from server-side probe or external runner evidence, not client-supplied booleans.',
      },
    },
    { status: 501 },
  );
}
