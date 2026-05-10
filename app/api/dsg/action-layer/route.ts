import { NextResponse } from 'next/server';
import { executeDsgAction } from '@/lib/dsg/action-layer/multi-flow-orchestrator';
import type { DsgActionFlow, DsgActionIntent, DsgActionMode } from '@/lib/dsg/action-layer/types';

export const dynamic = 'force-dynamic';

type Body = {
  flow?: DsgActionFlow;
  intent?: DsgActionIntent;
  mode?: DsgActionMode;
  payload?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.flow || !body.intent) {
    return NextResponse.json(
      {
        ok: false,
        status: 'BLOCKED',
        claim: 'ACTION_LAYER_INPUT_REQUIRED',
        blockedReasons: ['flow and intent are required'],
        nextAction: 'Send a deterministic action flow and intent.',
      },
      { status: 400 },
    );
  }

  return NextResponse.json(executeDsgAction({ flow: body.flow, intent: body.intent, mode: body.mode, payload: body.payload }));
}
