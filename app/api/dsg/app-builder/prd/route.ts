import { NextResponse } from 'next/server';
import { derivePrdFromGoal } from '@/lib/dsg/app-builder/prd/derive-prd';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const goal = typeof body.goal === 'string' ? body.goal : '';
    const result = derivePrdFromGoal(goal);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'APP_BUILDER_PRD_FAILED';
    return NextResponse.json(
      {
        ok: false,
        error: { code: message, message },
        boundary: {
          claimStatus: 'PRD_DRAFT_BLOCKED',
          productionReadyClaim: false,
          modelUsed: false,
        },
      },
      { status: message === 'APP_BUILDER_GOAL_TOO_SHORT' ? 400 : 500 },
    );
  }
}
