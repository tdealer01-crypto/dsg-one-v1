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
