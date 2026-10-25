// Reuse existing DSG Cinema AWS governed routes; never mint viewer credentials
// or bypass the distinct plan-bound Agent Executor / Verifier controllers.
export type CinemaVerifierKind = 'browser.extract' | 'browser.screenshot';

export function cinemaAgentToolContracts(target: string) {
  return [
    { name: 'browser.remote.read', target, description: 'อ่าน Shared Browser ด้วย Agent Verifier ที่ห้ามแก้หน้าเว็บ', required: [], optional: ['kind'], risk: 'read' },
    { name: 'browser.remote.connect', target, description: 'เชื่อม Agent Executor เข้ากับ Shared Browser เดิมตามแผน', required: [], optional: [], risk: 'high' },
    { name: 'browser.remote.execute', target, description: 'เปิด URL HTTPS ด้วย Agent Executor แล้วให้ Verifier อ่านผล ภายใต้ Signed Approval', required: ['url'], optional: [], risk: 'high' },
  ];
}

export function cinemaVerifierKind(value: unknown): CinemaVerifierKind {
  if (value === undefined) return 'browser.extract';
  if (value === 'browser.extract' || value === 'browser.screenshot') return value;
  throw new Error('CINEMA_VERIFIER_KIND_DENIED');
}

export function cinemaVerifierReadPayload(planId: string, agentIdentity: string, kind: CinemaVerifierKind) {
  if (kind !== 'browser.extract' && kind !== 'browser.screenshot') {
    throw new Error('CINEMA_VERIFIER_KIND_DENIED');
  }
  if (!planId || !agentIdentity) throw new Error('CINEMA_PLAN_OR_AGENT_REQUIRED');
  return {
    action: 'browser.remote.read',
    arguments: {
      plan_id: planId,
      agent_identity: agentIdentity,
      stop_on_success: true,
      steps: [{
        step_id: 'verify-page',
        action: { kind, controller: 'agent_verifier', parameters: {} },
      }],
    },
  };
}

/** One Plan, ordered provider calls, and a fresh read-only verifier result.
 * The executor's own response is never used as independent readback.
 */
export function cinemaNavigationSteps(targetUrl: string, agentIdentity: string, needsConnect: boolean) {
  let destination: URL;
  try { destination = new URL(targetUrl); }
  catch { throw new Error('PUBLIC_BROWSER_URL_REQUIRED'); }
  if (destination.protocol !== 'https:' || destination.username || destination.password)
    throw new Error('PUBLIC_BROWSER_URL_REQUIRED');
  if (!agentIdentity) throw new Error('CINEMA_PLAN_OR_AGENT_REQUIRED');
  const target = 'node.cinema-remote';
  const steps = [];
  if (needsConnect) steps.push({
    capability: 'browser.remote.connect', target, label: 'เชื่อม Remote Browser',
    makePayload: (planId: string) => {
      if (!planId) throw new Error('CINEMA_PLAN_OR_AGENT_REQUIRED');
      return { action: 'browser.remote.connect', arguments: {
        plan_id: planId, agent_identity: agentIdentity, step_id: 'connect', ttl_seconds: 600,
      } };
    },
  });
  steps.push({
    capability: 'browser.remote.execute', target, label: 'เปิดหน้าเว็บตามแผน',
    makePayload: (planId: string) => {
      if (!planId) throw new Error('CINEMA_PLAN_OR_AGENT_REQUIRED');
      return { action: 'browser.remote.run', arguments: {
        plan_id: planId, agent_identity: agentIdentity, stop_on_success: false,
        steps: [{ step_id: 'navigate', action: {
          kind: 'browser.navigate', controller: 'agent_executor', parameters: { url: destination.href },
        } }],
      } };
    },
  });
  steps.push({
    capability: 'browser.remote.read', target, label: 'ตรวจหน้าเว็บจริงด้วย Agent Verifier',
    makePayload: (planId: string) => cinemaVerifierReadPayload(planId, agentIdentity, 'browser.extract'),
  });
  return steps;
}

export function cinemaVerifierObservation(value: unknown, planId: string, planHash: string): { url: string; title: string } | null {
  const record = (input: unknown): Record<string, unknown> | null =>
    input !== null && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : null;
  const result = record(value);
  if (result?.ok !== true || result.all_steps_succeeded !== true ||
      result.completed_all_steps !== true || result.plan_id !== planId ||
      !Array.isArray(result.results) || result.results.length !== 1) return null;
  const step = record(result.results[0]);
  const response = record(step?.response);
  if (step?.ok !== true || step.controller !== 'agent_verifier' ||
      step.plan_id !== planId || step.plan_hash !== planHash ||
      step.fallback !== false || step.remote_status !== 200 ||
      response?.ok !== true || typeof response.url !== 'string') return null;
  try {
    const url = new URL(response.url);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    // The display does not need OAuth codes, private query strings or fragments.
    return { url: url.origin + url.pathname,
      title: typeof response.title === 'string' ? response.title.slice(0, 200) : '' };
  } catch { return null; }
}

