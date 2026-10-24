import { NextResponse } from 'next/server';
import { executeGovernedProposal } from '@/lib/dsg/core-spin/governed-execution';
import { getDsgUserAccessToken, requireVerifiedDsgActor } from '@/lib/dsg/server/context';
import { getRuntimeJob } from '@/lib/dsg/server/repository';
import {
  evaluateAutomationRun,
  getAutomationSteps,
  getLatestAutomationRun,
  projectAutomationWorkQuest,
  startAutomationRun,
  transitionAutomationStep,
} from '@/lib/dsg/server/automation-spacetime';

function repositoryContext(actor: { workspaceId: string; actorId: string }, request: Request) {
  return {
    workspaceId: actor.workspaceId,
    actorId: actor.actorId,
    userAccessToken: getDsgUserAccessToken(request.headers),
  };
}

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const actor = await requireVerifiedDsgActor(request.headers, 'job:read');
  const { jobId } = await context.params;
  try {
    const repo = repositoryContext(actor, request);
    // Reuse existing authenticated job:read scope and workspace-row guard.
    const job = await getRuntimeJob(repo, jobId);
    const run = await getLatestAutomationRun(repo, jobId);
    const steps = run ? await getAutomationSteps(repo, run.id) : [];
    const workQuest = projectAutomationWorkQuest({ job, run, steps, viewer: actor });
    return NextResponse.json({ ok: true, data: { run, steps, workQuest }, source: 'supabase' });
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
    action?: 'START' | 'EVALUATE' | 'STEP' | 'EXECUTE';
    maxRetries?: number;
    taskId?: string;
    expectedStatus?: string;
    nextStatus?: string;
    assignedAgent?: string | null;
    resultRef?: string | null;
    nextRunAt?: string | null;
    capability?: string;
    routeId?: string;
    payload?: Record<string, unknown>;
    intent?: string;
    approvalDecision?: 'APPROVE' | 'REJECT';
  };
  try {
    const repo = repositoryContext(actor, request);
    let run = await getLatestAutomationRun(repo, jobId);
    if (body.action === 'EXECUTE') {
      if (!run) throw new Error('AUTOMATION_RUN_NOT_FOUND');
      if (!body.taskId || !body.capability) {
        throw new Error('CORE_SPIN_TASK_AND_CAPABILITY_REQUIRED');
      }

      const job = await getRuntimeJob(repo, jobId);
      let steps = await getAutomationSteps(repo, run.id);
      let step = steps.find((item) => item.taskId === body.taskId);
      if (!step) throw new Error('AUTOMATION_STEP_NOT_FOUND');

      const before = await evaluateAutomationRun(repo, run);
      const ready = Array.isArray(before.ready_step_ids)
        ? before.ready_step_ids.map(String)
        : [];

      if (step.status === 'PENDING') {
        if (!ready.includes(body.taskId)) throw new Error('AUTOMATION_STEP_NOT_READY');
        await transitionAutomationStep(repo, {
          runId: run.id,
          taskId: body.taskId,
          expectedStatus: 'PENDING',
          nextStatus: 'READY',
          assignedAgent: body.assignedAgent ?? 'dsg-core-spin',
        });
        steps = await getAutomationSteps(repo, run.id);
        step = steps.find((item) => item.taskId === body.taskId);
        if (!step) throw new Error('AUTOMATION_STEP_NOT_FOUND_AFTER_READY');
      }

      if (step.status === 'WAITING' && !body.approvalDecision) {
        return NextResponse.json({
          ok: true,
          data: {
            run,
            state: 'WAITING_APPROVAL',
            taskId: body.taskId,
            approvalRequestId: step.resultRef,
            decision: before,
            executionAuthority: 'dsg-spacetime',
          },
        });
      }

      if (step.status === 'WAITING') {
        await transitionAutomationStep(repo, {
          runId: run.id,
          taskId: body.taskId,
          expectedStatus: 'WAITING',
          nextStatus: 'READY',
          assignedAgent: body.assignedAgent ?? step.assignedAgent ?? 'dsg-core-spin',
        });
        step = { ...step, status: 'READY' };
      }

      if (step.status !== 'READY') {
        throw new Error(`AUTOMATION_STEP_NOT_EXECUTABLE:${step.status}`);
      }

      await transitionAutomationStep(repo, {
        runId: run.id,
        taskId: body.taskId,
        expectedStatus: 'READY',
        nextStatus: 'RUNNING',
        assignedAgent: body.assignedAgent ?? step.assignedAgent ?? 'dsg-core-spin',
      });

      const result = await executeGovernedProposal({
        taskId: body.taskId,
        planId: `core-spin:${run.id}:${body.taskId}`,
        intent: body.intent?.trim() || job.goal,
        capability: body.capability,
        routeId: body.routeId,
        payload: body.payload,
        agentId: body.assignedAgent?.trim() || 'dsg-core-spin',
        principal: `workspace:${actor.workspaceId}`,
        approvalRequestId: step.resultRef ?? undefined,
        approvalDecision: body.approvalDecision,
      });

      const nextStatus =
        result.state === 'COMPLETED' ? 'COMPLETED'
          : result.state === 'WAITING_APPROVAL' ? 'WAITING'
            : result.state === 'BLOCKED' ? 'BLOCKED'
              : 'FAILED';
      const evidenceRef =
        result.evidence && typeof result.evidence === 'object'
          ? String((result.evidence as Record<string, unknown>).evidence_hash ?? '')
          : '';
      const resultRef =
        result.approvalRequestId || evidenceRef || result.reason || result.routeId || null;

      const transition = await transitionAutomationStep(repo, {
        runId: run.id,
        taskId: body.taskId,
        expectedStatus: 'RUNNING',
        nextStatus,
        assignedAgent: body.assignedAgent ?? 'dsg-core-spin',
        resultRef,
      });
      const nextDecision = await evaluateAutomationRun(repo, run);
      return NextResponse.json({
        ok: result.state === 'COMPLETED' || result.state === 'WAITING_APPROVAL',
        data: {
          run,
          result,
          transition,
          nextDecision,
          executionAuthority: 'dsg-spacetime',
          directProviderAccess: false,
        },
      }, { status: result.state === 'FAILED' ? 502 : 200 });
    }
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
