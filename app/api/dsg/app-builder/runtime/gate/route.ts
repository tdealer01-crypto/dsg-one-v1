import { NextResponse } from 'next/server';
import { evaluateRuntimeExecutionGate } from '@/lib/dsg/app-builder/runtime/execution-gate';
import type { RuntimeGateInput } from '@/lib/dsg/app-builder/runtime/types';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const input = body as RuntimeGateInput;

    if (!input.handoff) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: 'RUNTIME_HANDOFF_REQUIRED', message: 'Runtime handoff is required.' },
          boundary: { claimStatus: 'RUNTIME_EXECUTION_GATE_BLOCKED', runtimeExecutionStarted: false, productionReadyClaim: false },
        },
        { status: 400 },
      );
    }

    const result = evaluateRuntimeExecutionGate(input);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'RUNTIME_EXECUTION_GATE_FAILED';
    return NextResponse.json(
      {
        ok: false,
        error: { code: message, message },
        boundary: { claimStatus: 'RUNTIME_EXECUTION_GATE_BLOCKED', runtimeExecutionStarted: false, productionReadyClaim: false },
      },
      { status: 500 },
    );
  }
}
