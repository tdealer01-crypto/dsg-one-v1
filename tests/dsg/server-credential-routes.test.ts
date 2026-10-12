import { beforeEach, describe, expect, it, vi } from 'vitest';

type Role = 'OWNER' | 'ADMIN' | 'OPERATOR' | 'AUDITOR' | 'VIEWER';
const WS = '11111111-1111-4111-8111-111111111111';

const mocks = vi.hoisted(() => ({
  actor: null as null | { actorId: string; workspaceId: string; role: Role },
  user: null as null | { id: string; email: string | null },
  verifyFails: false,
  openai: vi.fn(),
  gatewayExecute: vi.fn(),
  gatewayPrepare: vi.fn(),
  katzillaQuery: vi.fn(),
  katzillaList: vi.fn(),
  katzillaStatus: vi.fn(),
  emit: vi.fn(),
  skills: {
    orchestrator: vi.fn(), codeEvolution: vi.fn(), deployMonitor: vi.fn(),
    browserResearch: vi.fn(), securityGate: vi.fn(), testCoverage: vi.fn(),
  },
}));

// Real permission table, fake identity: the test decides who the "verified" caller is.
vi.mock('@/lib/dsg/server/context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/dsg/server/context')>();
  return {
    ...actual,
    requireVerifiedDsgActor: vi.fn(async (_headers: Headers, permission: Parameters<typeof actual.assertDsgPermission>[1]) => {
      if (mocks.verifyFails) throw new Error('connect ECONNREFUSED db.internal.example:5432');
      return actual.assertDsgPermission(mocks.actor, permission);
    }),
    resolveVerifiedDsgUser: vi.fn(async () => {
      if (mocks.verifyFails) throw new Error('connect ECONNREFUSED db.internal.example:5432');
      return mocks.user;
    }),
  };
});
vi.mock('@/lib/dsg/ai/openai-adapter', () => ({ runOpenAIAdapter: mocks.openai }));
vi.mock('@/lib/dsg/connectors/ai-gateway', () => ({
  executeDsgAiGatewayRequest: mocks.gatewayExecute,
  prepareDsgAiGatewayRequest: mocks.gatewayPrepare,
}));
vi.mock('@/lib/dsg/connectors/katzilla', () => ({
  getKatzillaStatus: mocks.katzillaStatus,
  queryKatzilla: mocks.katzillaQuery,
  listKatzillaAgents: mocks.katzillaList,
}));
vi.mock('@/lib/dsg/lifecycle/activecampaign', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/dsg/lifecycle/activecampaign')>()),
  emitLifecycleEvent: mocks.emit,
}));
vi.mock('@/skills/orchestrator/skill', () => ({ runOrchestrator: mocks.skills.orchestrator }));
vi.mock('@/skills/code-evolution/skill', () => ({ runCodeEvolution: mocks.skills.codeEvolution }));
vi.mock('@/skills/deploy-monitor/skill', () => ({ runDeployMonitor: mocks.skills.deployMonitor }));
vi.mock('@/skills/browser-research/skill', () => ({ runBrowserResearch: mocks.skills.browserResearch }));
vi.mock('@/skills/security-gate/skill', () => ({ runSecurityGate: mocks.skills.securityGate }));
vi.mock('@/skills/test-coverage/skill', () => ({ runTestCoverage: mocks.skills.testCoverage }));

import { POST as aiGateway } from '@/app/api/dsg/ai-gateway/route';
import { POST as openaiChat } from '@/app/api/dsg/ai/openai/chat/route';
import { POST as designDraft } from '@/app/api/dsg/app-builder/design-draft/route';
import { POST as katzillaQuery } from '@/app/api/dsg/katzilla/query/route';
import { GET as katzillaAgents } from '@/app/api/dsg/katzilla/agents/route';
import { POST as lifecycleEvent } from '@/app/api/dsg/lifecycle/event/route';
import { GET as proofGet, POST as proofPost } from '@/app/api/dsg/app-builder/proof/route';
import { POST as orchestrator } from '@/app/api/dsg/agents/orchestrator/route';
import { POST as codeEvolution } from '@/app/api/dsg/agents/code-evolution/route';
import { POST as deployMonitor } from '@/app/api/dsg/agents/deploy-monitor/route';
import { POST as browserResearch } from '@/app/api/dsg/agents/browser-research/route';
import { POST as securityGate } from '@/app/api/dsg/agents/security-gate/route';
import { POST as testCoverage } from '@/app/api/dsg/agents/test-coverage/route';

const post = (path: string, body: unknown) =>
  new Request(`https://dsg.pics${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
const get = (path: string) => new Request(`https://dsg.pics${path}`);

const as = (role: Role | null) => {
  mocks.actor = role ? { actorId: 'user-1', workspaceId: WS, role } : null;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.actor = null;
  mocks.user = null;
  mocks.verifyFails = false;
  mocks.openai.mockResolvedValue({ outputText: '{}' });
  mocks.gatewayExecute.mockResolvedValue({ ok: true });
  mocks.gatewayPrepare.mockReturnValue({ ok: true });
  mocks.katzillaStatus.mockReturnValue({ configured: true });
  mocks.katzillaQuery.mockResolvedValue({ ok: true, status: 200 });
  mocks.katzillaList.mockResolvedValue({ ok: true, status: 200 });
  mocks.emit.mockResolvedValue({ ok: true, delivered: true, provider: 'activecampaign' });
  for (const skill of Object.values(mocks.skills)) skill.mockResolvedValue({ ok: true });
});

// Every route here uses a credential only the server holds, so a caller must be verified first.
const credentialRoutes = [
  { name: 'ai-gateway (prepare)', call: () => aiGateway(post('/api/dsg/ai-gateway', { provider: 'openai', goal: 'g', prompt: 'p' })), spy: () => mocks.gatewayPrepare, needs: 'job:plan' },
  { name: 'ai-gateway (execute)', call: () => aiGateway(post('/api/dsg/ai-gateway', { provider: 'openai', goal: 'g', prompt: 'p', execute: true })), spy: () => mocks.gatewayExecute, needs: 'skill:execute' },
  { name: 'openai chat', call: () => openaiChat(post('/api/dsg/ai/openai/chat', { input: 'hi' })), spy: () => mocks.openai, needs: 'job:plan' },
  { name: 'design-draft', call: () => designDraft(post('/api/dsg/app-builder/design-draft', { message: 'a todo app', history: [] })), spy: () => mocks.openai, needs: 'job:plan' },
  { name: 'katzilla query', call: () => katzillaQuery(post('/api/dsg/katzilla/query', { path: '/agents' })), spy: () => mocks.katzillaQuery, needs: 'skill:execute' },
  { name: 'katzilla agents', call: () => katzillaAgents(get('/api/dsg/katzilla/agents')), spy: () => mocks.katzillaList, needs: 'skill:read' },
];

describe('routes that spend server-held credentials', () => {
  for (const route of credentialRoutes) {
    it(`${route.name}: an anonymous caller gets 401 and the provider is never called`, async () => {
      as(null);
      const res = await route.call();
      expect(res.status).toBe(401);
      expect(route.spy()).not.toHaveBeenCalled();
    });

    it(`${route.name}: a verified OPERATOR reaches the provider`, async () => {
      as('OPERATOR');
      const res = await route.call();
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
      expect(route.spy()).toHaveBeenCalled();
    });
  }

  it('a VIEWER can read (skill:read) but cannot plan, execute or spend', async () => {
    as('VIEWER');
    for (const route of credentialRoutes) {
      const res = await route.call();
      if (route.needs === 'skill:read') {
        expect(res.status, route.name).toBe(200);
        expect(route.spy()).toHaveBeenCalled();
      } else {
        expect(res.status, route.name).toBe(403);
      }
    }
    expect(mocks.openai).not.toHaveBeenCalled();
    expect(mocks.gatewayExecute).not.toHaveBeenCalled();
    expect(mocks.katzillaQuery).not.toHaveBeenCalled();
  });

  it('a caller without a workspace session is refused (401), not served', async () => {
    as(null);
    expect((await openaiChat(post('/api/dsg/ai/openai/chat', { input: 'hi' }))).status).toBe(401);
  });

  it('when verification itself fails the caller gets a generic 503 and no internal detail', async () => {
    mocks.verifyFails = true;
    const res = await openaiChat(post('/api/dsg/ai/openai/chat', { input: 'hi' }));
    const text = await res.text();
    expect(res.status).toBe(503);
    expect(JSON.parse(text).error.code).toBe('DSG_AUTH_VERIFICATION_FAILED');
    expect(text).not.toContain('ECONNREFUSED');
    expect(mocks.openai).not.toHaveBeenCalled();
  });
});

describe('lifecycle events tag a CRM contact: only the signed-in person, only their own address', () => {
  const event = (email: string) => lifecycleEvent(post('/api/dsg/lifecycle/event', { event: 'proof_viewed', email }));

  it('anonymous -> 401, nothing emitted', async () => {
    expect((await event('victim@example.test')).status).toBe(401);
    expect(mocks.emit).not.toHaveBeenCalled();
  });

  it('another person\'s address is not emitted and not confirmed', async () => {
    mocks.user = { id: 'u1', email: 'alice@example.test' };
    const res = await event('victim@example.test');
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe('NOT_RECORDED');
    expect(body.delivery.delivered).toBe(false);
    expect(mocks.emit).not.toHaveBeenCalled();
  });

  it('the caller\'s own address (any letter case) is emitted for that address', async () => {
    mocks.user = { id: 'u1', email: 'alice@example.test' };
    await event('  Alice@Example.TEST ');
    expect(mocks.emit).toHaveBeenCalledWith(expect.objectContaining({ event: 'proof_viewed', email: 'alice@example.test' }));
  });

  it('does not reveal whether the address is an existing CRM contact', async () => {
    mocks.user = { id: 'u1', email: 'alice@example.test' };
    mocks.emit.mockResolvedValue({ ok: true, delivered: false, provider: 'activecampaign', reason: 'CONTACT_NOT_FOUND' });
    const text = await (await event('alice@example.test')).text();
    expect(text).not.toContain('CONTACT_NOT_FOUND');
  });

  it('an account without an email cannot trigger lifecycle events', async () => {
    mocks.user = { id: 'u1', email: null };
    await event('alice@example.test');
    expect(mocks.emit).not.toHaveBeenCalled();
  });
});

describe('app-builder proof: the dry-run is public, tagging a contact is not', () => {
  const run = (email?: string) => proofPost(post('/api/dsg/app-builder/proof', { goal: 'Build a CRM dashboard for small teams', ...(email ? { email } : {}) }));

  it('GET stays anonymous (the production smoke uses it)', async () => {
    const res = await proofGet();
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  it('anonymous POST with an email still returns the proof but emits nothing', async () => {
    const res = await run('victim@example.test');
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.lifecycle.reason).toBe('LOGIN_REQUIRED');
    expect(mocks.emit).not.toHaveBeenCalled();
  });

  it('signed-in user: another address is refused, own address is emitted', async () => {
    mocks.user = { id: 'u1', email: 'alice@example.test' };
    expect((await (await run('victim@example.test')).json()).lifecycle.reason).toBe('EMAIL_NOT_ACCOUNT_EMAIL');
    expect(mocks.emit).not.toHaveBeenCalled();
    await run('alice@example.test');
    expect(mocks.emit).toHaveBeenCalledWith(expect.objectContaining({ event: 'proof_created', email: 'alice@example.test' }));
  });
});

describe('/api/dsg/agents/*: run server-side skills only for a verified member of the claimed workspace', () => {
  const body = { jobId: 'job-1', workspaceId: WS, goal: 'a goal', actionId: 'a1', agentType: 'x', deploymentUrl: 'https://example.com', researchQuery: 'q', previousCoveragePct: 80, currentCoveragePct: 82 };
  const routes = [
    { name: 'orchestrator', fn: orchestrator, skill: () => mocks.skills.orchestrator, role: 'OPERATOR' as Role },
    { name: 'code-evolution', fn: codeEvolution, skill: () => mocks.skills.codeEvolution, role: 'OPERATOR' as Role },
    { name: 'deploy-monitor', fn: deployMonitor, skill: () => mocks.skills.deployMonitor, role: 'OPERATOR' as Role },
    { name: 'browser-research', fn: browserResearch, skill: () => mocks.skills.browserResearch, role: 'OPERATOR' as Role },
    { name: 'security-gate', fn: securityGate, skill: () => mocks.skills.securityGate, role: 'VIEWER' as Role },
    { name: 'test-coverage', fn: testCoverage, skill: () => mocks.skills.testCoverage, role: 'VIEWER' as Role },
  ];
  const call = (r: (typeof routes)[number], payload: unknown) => r.fn(post(`/api/dsg/agents/${r.name}`, payload) as never);

  for (const r of routes) {
    it(`${r.name}: anonymous -> 401, the skill never runs`, async () => {
      as(null);
      expect((await call(r, body)).status).toBe(401);
      expect(r.skill()).not.toHaveBeenCalled();
    });

    it(`${r.name}: a workspace id that is not the session's is refused`, async () => {
      as('OWNER');
      const res = await call(r, { ...body, workspaceId: '22222222-2222-4222-8222-222222222222' });
      expect(res.status).toBe(403);
      expect((await res.json()).error.code).toBe('DSG_WORKSPACE_MISMATCH');
      expect(r.skill()).not.toHaveBeenCalled();
    });

    it(`${r.name}: a member with ${r.role} runs it`, async () => {
      as(r.role);
      expect((await call(r, body)).status).toBe(200);
      expect(r.skill()).toHaveBeenCalled();
    });
  }

  it('control agents are not available to a VIEWER', async () => {
    as('VIEWER');
    for (const r of routes.filter((x) => x.role === 'OPERATOR')) expect((await call(r, body)).status, r.name).toBe(403);
  });

  it('the orchestrator caps the fan-out at 6 sub-goals', async () => {
    as('OPERATOR');
    const subGoals = Array.from({ length: 7 }, (_, i) => ({ agentType: 'a', goal: `g${i}` }));
    const res = await call(routes[0], { ...body, subGoals });
    expect(res.status).toBe(400);
    expect(mocks.skills.orchestrator).not.toHaveBeenCalled();
  });

  it('a skill failure does not leak its message to the caller', async () => {
    as('OPERATOR');
    mocks.skills.orchestrator.mockRejectedValue(new Error('spawn python3 ENOENT /srv/secret/path'));
    const res = await call(routes[0], body);
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('/srv/secret');
  });
});
