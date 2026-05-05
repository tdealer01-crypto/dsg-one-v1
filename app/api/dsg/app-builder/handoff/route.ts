import { NextResponse } from 'next/server';
import type { DsgPlanDraft, DsgPlanObserverResult } from '@/lib/dsg/app-builder/plan/types';
import { createRuntimeHandoffDraft } from '@/lib/dsg/app-builder/approval/create-handoff';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const plan = body.plan as DsgPlanDraft | undefined;
    const observer = body.observer as DsgPlanObserverResult | undefined;

    if (!plan || !observer) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: 'APP_BUILDER_PLAN_OBSERVER_REQUIRED', message: 'Plan and observer are required.' },
          boundary: { claimStatus: 'RUNTIME_HANDOFF_BLOCKED', productionReadyClaim: false, runtimeExecutionStarted: false },
        },
        { status: 400 },
      );
    }

    const result = createRuntimeHandoffDraft(plan, observer);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'APP_BUILDER_HANDOFF_FAILED';
    return NextResponse.json(
      {
        ok: false,
        error: { code: message, message },
        boundary: { claimStatus: 'RUNTIME_HANDOFF_BLOCKED', productionReadyClaim: false, runtimeExecutionStarted: false },
      },
      { status: 500 },
    );
  }
}
