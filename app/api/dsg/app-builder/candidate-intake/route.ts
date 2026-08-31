import { NextResponse } from 'next/server';
import { lockAppBuilderGoal } from '@/lib/dsg/app-builder/goal-lock';
import {
  appBuilderGoalFromCandidateRealization,
  requestRealizationAuthorization,
  verifyCandidateRealizationSpecV1,
} from '@/lib/dsg/app-builder/candidate-realization';
import { getAppBuilderRequestContext } from '@/lib/dsg/server/app-builder/context';
import { getCandidateServiceContext } from '@/lib/dsg/server/app-builder/candidate-service-context';
import { createAppBuilderJob, updateAppBuilderJob } from '@/lib/dsg/server/app-builder/repository';

function fail(error: unknown) {
  const code = error instanceof Error ? error.message : 'APP_BUILDER_CANDIDATE_INTAKE_FAILED';
  const status = code.includes('NOT_CONFIGURED')
    ? 503
    : code.includes('SIGNATURE_INVALID')
      ? 401
      : code.includes('MEMBERSHIP_REQUIRED') || code.includes('PERMISSION_DENIED') || code.includes('NOT_AUTHORIZED')
        ? 403
        : code.startsWith('DSG_')
          ? 401
          : 400;
  return NextResponse.json({ ok: false, error: { code, message: code } }, { status });
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const serviceCtx = await getCandidateServiceContext(req.headers, rawBody);
    const ctx = serviceCtx ?? await getAppBuilderRequestContext(req, 'job:create');

    let body: { spec?: unknown } | null = null;
    try {
      body = JSON.parse(rawBody) as { spec?: unknown };
    } catch {
      throw new Error('APP_BUILDER_CANDIDATE_INTAKE_INVALID_JSON');
    }

    const spec = verifyCandidateRealizationSpecV1(body?.spec);
    const authorization = await requestRealizationAuthorization(spec);
    const rawGoal = appBuilderGoalFromCandidateRealization(spec);
    const lockedGoal = lockAppBuilderGoal(rawGoal);
    const created = await createAppBuilderJob({ ctx, rawGoal, lockedGoal });
    const updated = await updateAppBuilderJob({
      ctx,
      id: created.id,
      patch: {
        metadata: {
          ...(created.metadata ?? {}),
          intakeSource: 'GOVERNED_SIMULATION_CANDIDATE',
          intakeAuthMode: serviceCtx ? 'SIGNED_SERVICE' : 'VERIFIED_USER',
          candidateRealizationSpec: spec,
          originCandidateCommit: spec.candidateCommit,
          realizationAuthorization: authorization,
          realizationAuthorizedAt: authorization.receipt.issuedAt,
          executionBoundary: 'APP_BUILDER_PLAN_AND_APPROVAL_STILL_REQUIRED',
          productionClaim: 'BLOCKED',
        },
      },
    });

    return NextResponse.json({
      ok: true,
      data: updated,
      boundary: {
        claimStatus: 'GOAL_LOCKED',
        controlPlaneAdmission: 'PASS',
        appBuilderPlanApproved: false,
        runtimeExecutionStarted: false,
        productionReadyClaim: false,
      },
    });
  } catch (error) {
    return fail(error);
  }
}
