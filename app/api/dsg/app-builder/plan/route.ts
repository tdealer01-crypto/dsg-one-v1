import { NextResponse } from 'next/server';
import type { DsgAppBuilderPrd } from '@/lib/dsg/app-builder/types/prd';
import { derivePlanFromPrd } from '@/lib/dsg/app-builder/plan/derive-plan';
import { observePlanDraft } from '@/lib/dsg/app-builder/plan/observe-plan';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const prd = body.prd as DsgAppBuilderPrd | undefined;

    if (!prd || typeof prd.title !== 'string' || typeof prd.userProblem !== 'string') {
      return NextResponse.json(
        {
          ok: false,
          error: { code: 'APP_BUILDER_PRD_REQUIRED', message: 'A PRD object is required.' },
          boundary: { claimStatus: 'PLAN_DRAFT_BLOCKED', productionReadyClaim: false, runtimeExecutionReady: false },
        },
        { status: 400 },
      );
    }

    const plan = derivePlanFromPrd(prd);
    const observer = observePlanDraft(plan);

    return NextResponse.json({
      ok: true,
      plan,
      observer,
      boundary: {
        claimStatus: 'PLAN_DRAFT_ONLY',
        productionReadyClaim: false,
        runtimeExecutionReady: false,
        z3RuntimeProof: false,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'APP_BUILDER_PLAN_FAILED';
    return NextResponse.json(
      {
        ok: false,
        error: { code: message, message },
        boundary: { claimStatus: 'PLAN_DRAFT_BLOCKED', productionReadyClaim: false, runtimeExecutionReady: false },
      },
      { status: 500 },
    );
  }
}
