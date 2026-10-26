import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  nativeBoundedDraft, verifyBoundedPreview, verifiedBoundedCompletion,
  mayConfirmBoundedReview, confirmReviewedBoundedPlan,
  consumeBoundedConfirmation, applyBoundedStatus, boundedPlanMayClose,
} from '@/lib/dsg/user-bound/bounded-plan-contract';
import { spacetimePayloadHash, type JsonRecord, type WorkroomExecution } from '@/lib/dsg/user-bound/workroom-contract';

const actor = { agent_id: 'dsg-web-workroom', principal: 'oauth:auth0|owner' };
const write: WorkroomExecution = { plan_id: 'plan-real-composed', plan_hash: 'a'.repeat(64),
  route_id: 'route.desktop-native.fs-write', agent: actor,
  payload: { action: 'device.fs.write', arguments: { path: 'workspace/new.txt', content: 'Exact content', mode: 'create_new' } } };
const read: WorkroomExecution = { ...write, route_id: 'route.desktop-native.fs-read',
  payload: { action: 'device.fs.read', arguments: { path: 'workspace/new.txt' } } };
const context = { workspaceId: 'workspace-1', deviceId: 'device-bound' };
const draft = () => nativeBoundedDraft(write, read, context);

async function preview() {
  return { request_id: 'dsg_bp_review_123', status: 'VIEWED', review_digest: 'b'.repeat(64),
    scope: { plan_id: write.plan_id, plan_hash: write.plan_hash, workspace_id: context.workspaceId,
      device_id: context.deviceId, agent_id: actor.agent_id, expires_at: Math.floor(Date.now() / 1000) + 240,
      steps: [{ step_id: 'step-1', route_id: write.route_id,
        payload_hash: await spacetimePayloadHash(write.payload), origin: 'https://aws.dsg.pics',
        effect: 'file_write_exact', risk: 'high', target_ref: 'workspace/new.txt',
        review_summary: 'Create exact file workspace/new.txt and verify readback' }] } };
}

describe('existing Workroom plan to bounded owner review', () => {
  it('stages only the existing write; the exact full read remains bound to the same composed plan', () => {
    expect(draft().requests).toEqual([write]);
    expect(draft().readRequest).toEqual(read);
  });
  it.each([
    { ...write, payload: { ...write.payload, arguments: { path: 'workspace/new.txt', content: 'x' } } },
    { ...write, payload: { ...write.payload, arguments: { path: 'workspace/new.txt', content: 'x', mode: 'overwrite' } } },
    { ...write, agent: { ...actor, principal: 'customer:forged' } },
  ])('does not silently invent a create-new mode or owner authority', (request) => {
    expect(() => nativeBoundedDraft(request, read, context)).toThrow();
  });
  it('rejects an unbound/truncated/foreign read or a different device context', () => {
    expect(() => nativeBoundedDraft(write, { ...read, plan_hash: 'c'.repeat(64) }, context)).toThrow();
    expect(() => nativeBoundedDraft(write, { ...read, payload: { action: 'device.fs.read', arguments: { path: 'other.txt' } } }, context)).toThrow();
    expect(() => nativeBoundedDraft(write, { ...read, payload: { action: 'device.fs.read', arguments: { path: 'workspace/new.txt', length: 100 } } }, context)).toThrow();
    expect(() => nativeBoundedDraft(write, read, { ...context, deviceId: '' })).toThrow();
  });
  it('binds the visible backend preview to the exact local composed request and context', async () => {
    const raw = await preview();
    const view = await verifyBoundedPreview(raw, draft(), raw.request_id);
    expect(view.requestId).toBe(raw.request_id);
    expect(view.reviewDigest).toBe(raw.review_digest);
    expect(view.steps[0].summary).toContain('workspace/new.txt');
    for (const key of ['plan_hash', 'workspace_id', 'device_id', 'agent_id']) {
      await expect(verifyBoundedPreview({ ...raw, scope: { ...raw.scope, [key]: 'wrong' } }, draft(), raw.request_id)).rejects.toThrow();
    }
    await expect(verifyBoundedPreview({ ...raw, request_id: 'another' }, draft(), raw.request_id)).rejects.toThrow();
    await expect(verifyBoundedPreview({ ...raw, scope: { ...raw.scope,
      steps: [{ ...raw.scope.steps[0], payload_hash: 'c'.repeat(64) }] } }, draft(), raw.request_id)).rejects.toThrow();
  });
  it('requires review acknowledgement and the unchanged generation before MFA/confirm', () => {
    expect(mayConfirmBoundedReview({ acknowledged: false, submissionStarted: false, reviewedGeneration: 2 }, 2)).toBe(false);
    expect(mayConfirmBoundedReview({ acknowledged: true, submissionStarted: false, reviewedGeneration: 2 }, 3)).toBe(false);
    expect(mayConfirmBoundedReview({ acknowledged: true, submissionStarted: true, reviewedGeneration: 2 }, 2)).toBe(false);
    expect(mayConfirmBoundedReview({ acknowledged: true, submissionStarted: false, reviewedGeneration: 2 }, 2)).toBe(true);
  });
  it('only requests fresh MFA after review and confirms the exact reviewed digest once', async () => {
    const raw = await preview();
    const view = await verifyBoundedPreview(raw, draft(), raw.request_id);
    const order: string[] = ['backend view rendered', 'owner acknowledges'];
    let submitted = false;
    const confirm = vi.fn(async (_token: string, args: JsonRecord) => { order.push('confirm'); return args; });
    await confirmReviewedBoundedPlan(view, {
      isCurrent: () => !submitted,
      requestMfa: async () => { order.push('fresh MFA'); return 'memory-only-token'; },
      onSubmitting: () => { submitted = true; order.push('consume submission'); }, confirm,
    });
    expect(order).toEqual(['backend view rendered', 'owner acknowledges', 'fresh MFA', 'consume submission', 'confirm']);
    expect(confirm).toHaveBeenCalledExactlyOnceWith('memory-only-token', {
      request_id: view.requestId, reviewed_digest: view.reviewDigest,
    });
    await expect(confirmReviewedBoundedPlan(view, {
      isCurrent: () => !submitted, requestMfa: vi.fn(), onSubmitting: vi.fn(), confirm,
    })).rejects.toThrow('BOUNDED_REVIEW_CHANGED_OR_EXPIRED');
    expect(confirm).toHaveBeenCalledTimes(1);
  });
  it('cancels confirmation if plan, device or workspace changes during MFA', async () => {
    const raw = await preview();
    const view = await verifyBoundedPreview(raw, draft(), raw.request_id);
    let current = true;
    const confirm = vi.fn();
    await expect(confirmReviewedBoundedPlan(view, {
      isCurrent: () => current,
      requestMfa: async () => { current = false; return 'memory-only-token'; },
      onSubmitting: vi.fn(), confirm,
    })).rejects.toThrow('BOUNDED_REVIEW_CHANGED_OR_EXPIRED');
    expect(confirm).not.toHaveBeenCalled();
  });
  it('consumes the confirmation attempt before an uncertain response, so status is the next action', async () => {
    const raw = await preview();
    const view = await verifyBoundedPreview(raw, draft(), raw.request_id);
    let submitted = false;
    const requestMfa = vi.fn(async () => 'memory-only-token');
    const confirm = vi.fn(async () => { throw new Error('network failed'); });
    const lifecycle = { isCurrent: () => !submitted, requestMfa,
      onSubmitting: () => { submitted = true; }, confirm };
    await expect(confirmReviewedBoundedPlan(view, lifecycle)).rejects.toThrow('network failed');
    await expect(confirmReviewedBoundedPlan(view, lifecycle)).rejects.toThrow('BOUNDED_REVIEW_CHANGED_OR_EXPIRED');
    expect(requestMfa).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledTimes(1);
  });
  it('never uses a stale pre-confirm status to dismiss an uncertain confirmation', () => {
    const before = { submissionStarted: false, report: { status: 'WAITING_MFA', authorization_status: 'NOT_GRANTED' } };
    const submitted = consumeBoundedConfirmation(before);
    expect(submitted.report).toBeUndefined();
    expect(boundedPlanMayClose(submitted)).toBe(false);
    const active = applyBoundedStatus(submitted, { status: 'WAITING_WORKER', authorization_status: 'ACTIVE', grant_id: 'grant-1' });
    expect(active.submissionStarted).toBe(true);
    expect(active.grantId).toBe('grant-1');
    expect(boundedPlanMayClose(active)).toBe(false);
    expect(boundedPlanMayClose(applyBoundedStatus(active, { status: 'REVOKED', authorization_status: 'REVOKED' }))).toBe(true);
    // A different owner tab may have confirmed while this tab was reviewing.
    expect(applyBoundedStatus(before, { status: 'WAITING_WORKER', authorization_status: 'ACTIVE' }).submissionStarted).toBe(true);
  });
  it('does not turn a queued job, dispatch, unknown outcome or missing evidence into completion', async () => {
    const raw = await preview();
    const view = await verifyBoundedPreview(raw, draft(), raw.request_id);
    const status = { workflow_version: 'dsg.bounded-plan.workflow.v1', request_id: view.requestId,
      plan_id: write.plan_id, plan_hash: write.plan_hash, workspace_id: context.workspaceId,
      device_id: context.deviceId, status: 'COMPLETED', completion_verified: true,
      completed_steps: 1, total_steps: 1, automatic_retry: false,
      steps: [{ step_id: 'step-1', route_id: write.route_id, status: 'COMPLETED', evidence_hash: 'd'.repeat(64) }] };
    expect(verifiedBoundedCompletion(status, view)).toBe(true);
    expect(verifiedBoundedCompletion({ ...status, status: 'WAITING_WORKER' }, view)).toBe(false);
    expect(verifiedBoundedCompletion({ ...status, status: 'RECONCILE_REQUIRED' }, view)).toBe(false);
    expect(verifiedBoundedCompletion({ ...status, completion_verified: false }, view)).toBe(false);
    expect(verifiedBoundedCompletion({ ...status, device_id: 'different' }, view)).toBe(false);
    expect(verifiedBoundedCompletion({ ...status, steps: [{ ...status.steps[0], evidence_hash: undefined }] }, view)).toBe(false);
  });
  it('advertises the actual versioned Native write contract to the existing planner', () => {
    const source = readFileSync(new URL('../../components/dsg-live-workroom.tsx', import.meta.url), 'utf8');
    expect(source).toMatch(/name: 'device\.fs\.write'[^\n]*required: \['path', 'content', 'mode'\]/);
  });
});
