import { NextResponse } from 'next/server';
import { requireVerifiedDsgActor } from '@/lib/dsg/server/context';
import { getBearerToken } from '@/lib/dsg/server/supabase-rpc';
import {
  evaluateAutomationRun,
  getAutomationSteps,
  getLatestAutomationRun,
  startAutomationRun,
  transitionAutomationStep,
} from '@/lib/dsg/server/automation-spacetime';

function repositoryContext(actor: { workspaceId: string; actorId: string }, request: Request) {
  return {
    workspaceId: actor.workspaceId,
    actorId: actor.actorId,
    userAccessToken: getBearerToken(request.headers),
  };
}

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const actor = await requireVerifiedDsgActor(request.headers, 'job:read');
  const { jobId } = await context.params;
  try {
    const repo = repositoryContext(actor, request);
    const run = await getLatestAutomationRun(repo, jobId);
    if (!run) return NextResponse.json({ ok: true, data: { run: null, steps: [] }, source: 'supabase' });
    const steps = await getAutomationSteps(repo, run.id);
    return NextResponse.json({ ok: true, data: { run, steps }, source: 'supabase' });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: { code: error instanceof Error ? error.message : 'AUTOMATION_STATUS_FAILED' } },
      { status: 403 },
    );
  }
}

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const actor = await requireVerifiedDsgActor(request.headers, 'job:control');
  const { jobId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    action?: 'START' | 'EVALUATE' | 'STEP';
    maxRetries?: number;
    taskId?: string;
    expectedStatus?: string;
    nextStatus?: string;
    assignedAgent?: string | null;
    resultRef?: string | null;
    nextRunAt?: string | null;
  };
  try {
    const repo = repositoryContext(actor, request);
    let run = await getLatestAutomationRun(repo, jobId);
    if (body.action === 'STEP') {
      if (!run) throw new Error('AUTOMATION_RUN_NOT_FOUND');
      if (!body.taskId || !body.expectedStatus || !body.nextStatus) throw new Error('AUTOMATION_STEP_INPUT_REQUIRED');
      const transition = await transitionAutomationStep(repo, {
        runId: run.id,
        taskId: body.taskId,
        expectedStatus: body.expectedStatus,
        nextStatus: body.nextStatus,
        assignedAgent: body.assignedAgent,
        resultRef: body.resultRef,
        nextRunAt: body.nextRunAt,
      });
      const decision = await evaluateAutomationRun(repo, run);
      return NextResponse.json({ ok: true, data: { run, transition, decision, governanceRequired: true } });
    }
    if (body.action === 'START' || !run) {
      const started = await startAutomationRun(repo, { jobId, maxRetries: body.maxRetries });
      run = await getLatestAutomationRun(repo, jobId);
      if (!run || run.id !== started.runId) throw new Error('AUTOMATION_RUN_READBACK_FAILED');
    } else if (body.action && body.action !== 'EVALUATE') {
      throw new Error('AUTOMATION_ACTION_UNSUPPORTED');
    }
    const decision = await evaluateAutomationRun(repo, run);
    return NextResponse.json({
      ok: true,
      data: {
        run,
        decision,
        executionAuthority: 'none',
        governanceRequired: true,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: { code: error instanceof Error ? error.message : 'AUTOMATION_EXECUTION_FAILED' } },
      { status: 403 },
    );
  }
}
