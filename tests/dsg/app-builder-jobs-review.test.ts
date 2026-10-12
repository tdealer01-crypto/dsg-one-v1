import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Independent review of the persisted-jobs repair: one Supabase project for membership and for jobs,
// no raw upstream text in any App Builder response, honest labels in the Workspace Jobs panel.

const mocks = vi.hoisted(() => ({ verify: vi.fn() }));
vi.mock('@/lib/dsg/server/context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/dsg/server/context')>()),
  requireVerifiedDsgActor: mocks.verify,
}));

import { getDsgSupabaseRpcConfig } from '@/lib/dsg/server/supabase-rpc';
import { supabaseRest } from '@/lib/dsg/server/app-builder/supabase-rest';
import { getAppBuilderRequestContext } from '@/lib/dsg/server/app-builder/context';
import { createAppBuilderJob, getAppBuilderJob, listAppBuilderJobs } from '@/lib/dsg/server/app-builder/repository';
import { APP_BUILDER_JOB_PUBLIC_ERROR_CODES, classifyAppBuilderJobError } from '@/lib/dsg/server/app-builder/job-error';
import { GET as listJobs, POST as createJob } from '@/app/api/dsg/app-builder/jobs/route';
import { POST as executeJob } from '@/app/api/dsg/app-builder/jobs/[jobId]/execute/route';

const src = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');
const URL_NAMES = ['DSG_ONE_V1_SUPABASE_URL', 'NEXT_PUBLIC_DSG_ONE_V1_SUPABASE_URL', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'] as const;
const KEY_NAMES = ['DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY'] as const;
const ALL_NAMES = [...URL_NAMES, ...KEY_NAMES, 'SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];

const RAW = 'relation "public.dsg_workspace_members" does not exist (SECRET-TABLE-HINT)';
const req = (path: string, init?: RequestInit) => new Request(`https://dsg.pics${path}`, init);
const JOB = '33333333-3333-4333-8333-333333333333';

beforeEach(() => {
  vi.resetAllMocks();
  for (const name of ALL_NAMES) vi.stubEnv(name, '');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('membership and jobs resolve to the same Supabase project (or the jobs client refuses to run)', () => {
  // Every combination of the four URL variables (distinct project per name) x the two service-role variables.
  const combos: Array<{ urls: Record<string, string>; keys: Record<string, string> }> = [];
  for (let u = 0; u < 1 << URL_NAMES.length; u += 1) {
    for (let k = 0; k < 1 << KEY_NAMES.length; k += 1) {
      combos.push({
        urls: Object.fromEntries(URL_NAMES.flatMap((name, i) => (u & (1 << i) ? [[name, `https://project-${i}.example.test`]] : []))),
        keys: Object.fromEntries(KEY_NAMES.flatMap((name, i) => (k & (1 << i) ? [[name, `sb_secret_key_${i}`]] : []))),
      });
    }
  }

  it(`holds for all ${combos.length} environment combinations`, async () => {
    let reachedDatabase = 0;
    let refused = 0;
    for (const combo of combos) {
      for (const name of ALL_NAMES) vi.stubEnv(name, '');
      for (const [name, value] of [...Object.entries(combo.urls), ...Object.entries(combo.keys)]) vi.stubEnv(name, value);

      let auth: ReturnType<typeof getDsgSupabaseRpcConfig> | null = null;
      try { auth = getDsgSupabaseRpcConfig(); } catch { auth = null; }

      const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response('[]', { status: 200 }));
      vi.stubGlobal('fetch', fetchMock);
      const outcome = await supabaseRest({ path: 'dsg_app_builder_jobs' }).then(() => 'ok', (e: Error) => e.message);

      if (outcome === 'ok') {
        reachedDatabase += 1;
        // Jobs talk to exactly the project the membership check talks to, with the same service credential.
        expect(auth, JSON.stringify(combo)).not.toBeNull();
        expect(String(fetchMock.mock.calls[0][0]).startsWith(`${auth!.url}/rest/v1/`), JSON.stringify(combo)).toBe(true);
        expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>).apikey, JSON.stringify(combo)).toBe(auth!.key);
      } else {
        refused += 1;
        expect(outcome).toMatch(/^APP_BUILDER_DB_(URL|SERVICE_ROLE)_NOT_CONFIGURED$/);
        expect(fetchMock).not.toHaveBeenCalled();
      }
    }
    expect(reachedDatabase).toBeGreaterThan(0);
    expect(refused).toBeGreaterThan(0);
  });
});

describe('a failure in the authentication / membership backend is reported as that, never as raw upstream text', () => {
  it('getAppBuilderRequestContext passes known authorization codes through and bounds everything else', async () => {
    for (const code of ['DSG_AUTH_REQUIRED', 'DSG_CONTEXT_REQUIRED', 'DSG_PERMISSION_DENIED']) {
      mocks.verify.mockRejectedValueOnce(new Error(code));
      await expect(getAppBuilderRequestContext(req('/x'), 'job:read')).rejects.toThrow(code);
    }
    for (const raw of [RAW, 'DSG_REST_500', 'DSG_SUPABASE_URL_REQUIRED:DSG_ONE_V1_SUPABASE_URL|SUPABASE_URL', 'fetch failed']) {
      mocks.verify.mockRejectedValueOnce(new Error(raw));
      await expect(getAppBuilderRequestContext(req('/x'), 'job:read')).rejects.toThrow('APP_BUILDER_AUTH_BACKEND_UNAVAILABLE');
    }
  });

  it('the list API answers 503 APP_BUILDER_AUTH_BACKEND_UNAVAILABLE, with no table name or env name in the body', async () => {
    mocks.verify.mockRejectedValue(new Error(RAW));
    const res = await listJobs(req('/api/dsg/app-builder/jobs'));
    const text = await res.text();
    expect(res.status).toBe(503);
    expect(JSON.parse(text).error.code).toBe('APP_BUILDER_AUTH_BACKEND_UNAVAILABLE');
    expect(text).not.toMatch(/SECRET-TABLE-HINT|dsg_workspace_members/);
  });

  it('a sibling route that does its own error handling no longer echoes the raw text either', async () => {
    mocks.verify.mockRejectedValue(new Error(RAW));
    const res = await executeJob(req(`/api/dsg/app-builder/jobs/${JOB}/execute`, { method: 'POST' }), { params: Promise.resolve({ jobId: JOB }) });
    const text = await res.text();
    expect(text).not.toMatch(/SECRET-TABLE-HINT|dsg_workspace_members/);
    expect(res.status).not.toBe(200);
  });

  it('an unparseable request body is a client error (400), not a server fault', async () => {
    mocks.verify.mockResolvedValue({ actorId: 'u1', workspaceId: 'w1', role: 'OPERATOR' });
    for (const body of ['{not json', 'null', '[]', '"text"']) {
      const res = await createJob(req('/api/dsg/app-builder/jobs', { method: 'POST', body, headers: { 'content-type': 'application/json' } }));
      expect(res.status, body).toBe(400);
      expect((await res.json()).error.code).toBe('APP_BUILDER_REQUEST_INVALID');
    }
  });

  it('the classification table knows the new codes and nothing leaks through the default branch', () => {
    expect(classifyAppBuilderJobError(new Error('APP_BUILDER_AUTH_BACKEND_UNAVAILABLE'))).toEqual({ code: 'APP_BUILDER_AUTH_BACKEND_UNAVAILABLE', status: 503 });
    expect(classifyAppBuilderJobError(new Error('APP_BUILDER_REQUEST_INVALID'))).toEqual({ code: 'APP_BUILDER_REQUEST_INVALID', status: 400 });
    expect(classifyAppBuilderJobError(new Error(RAW))).toEqual({ code: 'APP_BUILDER_REQUEST_FAILED', status: 500 });
  });
});

describe('Workspace Jobs panel labels the failure honestly', () => {
  const ui = src('components/dsg/app-builder/AppBuilderConsoleClient.tsx');

  it('every public error code the server can return is one the panel recognises (no drift)', () => {
    for (const code of APP_BUILDER_JOB_PUBLIC_ERROR_CODES) expect(ui, code).toContain(code);
  });

  it('a non-JSON answer (for example an HTML 502 from the proxy) is never shown as a JavaScript parse error', () => {
    expect(ui).toMatch(/response\.json\(\)\.catch\(/);
    expect(ui).toContain('JOBS_API_UNREACHABLE');
    expect(ui).not.toMatch(/setJobsReadMessage\(error instanceof Error \? error\.message/);
  });
});

describe('tenant isolation survives the repair (behaviour against a fake PostgREST that honours the filters)', () => {
  const WS_A = 'aaaaaaaa-0000-4000-8000-000000000001';
  const WS_B = 'bbbbbbbb-0000-4000-8000-000000000002';
  const JOB_A = 'aaaaaaaa-1111-4111-8111-111111111111';
  const JOB_B = 'bbbbbbbb-1111-4111-8111-111111111111';
  const row = (id: string, workspace: string) => ({ id, workspace_id: workspace, created_by: 'u', status: 'GOAL_LOCKED', claim_status: 'NOT_STARTED', created_at: 'x', updated_at: 'x' });
  const ctxA = { workspaceId: WS_A, actorId: 'user-a', actorRole: 'OPERATOR' as const, permission: 'job:read' as const };
  let posted: Record<string, unknown> | null = null;

  beforeEach(() => {
    vi.stubEnv('DSG_ONE_V1_SUPABASE_URL', 'https://db.example.test');
    vi.stubEnv('DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY', 'sb_secret_test');
    posted = null;
    const rows = [row(JOB_A, WS_A), row(JOB_B, WS_B)];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (init?.method === 'POST') {
        posted = JSON.parse(String(init.body));
        return new Response(JSON.stringify([{ ...row('cccccccc-1111-4111-8111-111111111111', String(posted?.workspace_id)), ...posted }]), { status: 200 });
      }
      const eq = (name: string) => url.searchParams.get(name)?.replace(/^eq\./, '');
      const matches = rows.filter((r) => (!eq('workspace_id') || r.workspace_id === eq('workspace_id')) && (!eq('id') || r.id === eq('id')));
      return new Response(JSON.stringify(matches), { status: 200 });
    }));
  });

  it('listing returns only the caller\'s workspace rows', async () => {
    const jobs = await listAppBuilderJobs(ctxA);
    expect(jobs.map((j) => j.id)).toEqual([JOB_A]);
  });

  it('another workspace\'s job id is "not found", never returned', async () => {
    await expect(getAppBuilderJob(ctxA, JOB_B)).rejects.toThrow('APP_BUILDER_JOB_NOT_FOUND');
    expect((await getAppBuilderJob(ctxA, JOB_A)).workspaceId).toBe(WS_A);
  });

  it('a created job takes workspace and author from the verified context, not from the request body', async () => {
    await createAppBuilderJob({
      ctx: ctxA,
      rawGoal: { workspace_id: WS_B, created_by: 'attacker' } as never,
      lockedGoal: { goal: 'x' } as never,
    });
    expect(posted).toMatchObject({ workspace_id: WS_A, created_by: 'user-a', status: 'GOAL_LOCKED', claim_status: 'NOT_STARTED' });
  });

  it('the repair touches no approval, plan or execution gate: those routes are unchanged by this PR', () => {
    for (const rel of ['approval', 'plan', 'plan-review', 'execute', 'runtime-handoff', 'tool-call']) {
      const route = src(`app/api/dsg/app-builder/jobs/[jobId]/${rel}/route.ts`);
      expect(route, rel).toContain('getAppBuilderRequestContext');
    }
    expect(src('app/api/dsg/app-builder/jobs/[jobId]/execute/route.ts')).toContain("job.status !== 'READY_FOR_RUNTIME'");
    expect(src('app/api/dsg/app-builder/jobs/[jobId]/approval/route.ts')).toContain('APP_BUILDER_GATE_BLOCKED');
  });
});
