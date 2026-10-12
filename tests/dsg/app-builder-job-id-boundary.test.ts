import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const WS = '11111111-1111-4111-8111-111111111111';
const JOB = '33333333-3333-4333-8333-333333333333';
const ctx = { workspaceId: WS, actorId: 'user-1', actorRole: 'OPERATOR' as const, permission: 'job:read' as const };

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.SUPABASE_URL = 'http://db.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'local-test-key';
  fetchMock = vi.fn(async () => new Response(JSON.stringify([{ id: JOB, workspace_id: WS, status: 'GOAL_LOCKED', claim_status: 'NOT_STARTED', created_at: 'x', updated_at: 'x' }]), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

import { getAppBuilderJob, updateAppBuilderJob } from '@/lib/dsg/server/app-builder/repository';

// supabaseRest uses the SERVICE key, so the workspace filter in the query string is the only tenant boundary.
describe('app-builder job id from the URL cannot widen the query', () => {
  it('a normal UUID reads exactly one job inside the caller\'s workspace', async () => {
    await getAppBuilderJob(ctx, JOB);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get('id')).toBe(`eq.${JOB}`);
    expect(url.searchParams.get('workspace_id')).toBe(`eq.${WS}`);
    expect(url.hash).toBe('');
  });

  for (const hostile of [
    `${JOB}#`,
    `${JOB}%23`,
    `${JOB}&workspace_id=neq.${WS}`,
    `${JOB}&select=*`,
    `${JOB}?x=1`,
    '..',
    '',
    'not-a-uuid',
  ]) {
    it(`refuses ${JSON.stringify(hostile)} before any request is made (read and patch)`, async () => {
      await expect(getAppBuilderJob(ctx, hostile)).rejects.toThrow('APP_BUILDER_JOB_ID_INVALID');
      await expect(updateAppBuilderJob({ ctx, id: hostile, patch: { status: 'X' } })).rejects.toThrow('APP_BUILDER_JOB_ID_INVALID');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  }

  it('a workspace id that is not a UUID is refused too', async () => {
    await expect(getAppBuilderJob({ ...ctx, workspaceId: `${WS}#` }, JOB)).rejects.toThrow('APP_BUILDER_JOB_ID_INVALID');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
