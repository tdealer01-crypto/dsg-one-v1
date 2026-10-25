import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { cinemaAgentToolContracts, cinemaNavigationSteps, cinemaVerifierKind, cinemaVerifierObservation, cinemaVerifierReadPayload } from '@/lib/dsg/user-bound/cinema-controller-contract';
import { describeCinemaAccountIssue } from '@/components/dsg-cinema-oauth-viewer';

describe('DSG Cinema multi-controller Agent menu', () => {
  it('runs connect, navigation, then a separate read-only provider call within one Plan', () => {
    const steps = cinemaNavigationSteps('https://example.test/work', 'owner-agent', true);
    expect(steps.map(step => step.capability)).toEqual([
      'browser.remote.connect', 'browser.remote.execute', 'browser.remote.read',
    ]);
    const payloads = steps.map(step => step.makePayload('actual-bound-plan'));
    expect(payloads.every(body => body.arguments.plan_id === 'actual-bound-plan' &&
      body.arguments.agent_identity === 'owner-agent')).toBe(true);
    expect(payloads[1]).toMatchObject({ action: 'browser.remote.run', arguments: {
      steps: [{ action: { kind: 'browser.navigate', controller: 'agent_executor' } }],
    } });
    const executeArgs = payloads[1].arguments;
    expect('steps' in executeArgs && executeArgs.steps).toHaveLength(1);
    expect(payloads[2]).toEqual(cinemaVerifierReadPayload('actual-bound-plan', 'owner-agent', 'browser.extract'));
  });

  it('reuses only the verified connection while still independently verifying every navigation', () => {
    const steps = cinemaNavigationSteps('https://example.test', 'owner-agent', false);
    expect(steps.map(step => step.capability)).toEqual(['browser.remote.execute', 'browser.remote.read']);
    expect(steps[0].makePayload('plan-a').arguments.plan_id).toBe('plan-a');
    expect(steps[1].makePayload('plan-b').arguments.plan_id).toBe('plan-b');
    expect(() => steps[0].makePayload('')).toThrow('CINEMA_PLAN_OR_AGENT_REQUIRED');
  });

  it('binds the exact HTTPS target origin before approval without granting a wildcard or another site', () => {
    const steps = cinemaNavigationSteps('https://example.test:8443/work?view=task#result', 'owner-agent', false);
    expect(steps[0].makePayload('plan-origin')).toMatchObject({ arguments: {
      steps: [{ action: { parameters: {
        url: 'https://example.test:8443/work?view=task#result',
        browser_allowed_origins: 'https://example.test:8443',
      } } }],
    } });
  });

  it('refuses unbound agents and credential-bearing or non-HTTPS navigation before compose', () => {
    for (const target of ['not-a-url', 'http://example.test', 'https://user:password@example.test']) {
      expect(() => cinemaNavigationSteps(target, 'owner-agent', true)).toThrow('PUBLIC_BROWSER_URL_REQUIRED');
    }
    expect(() => cinemaNavigationSteps('https://example.test', '', true)).toThrow('CINEMA_PLAN_OR_AGENT_REQUIRED');
  });

  it('displays only a complete independent verifier observation bound to the current plan', () => {
    const hash = 'a'.repeat(64);
    const step = { ok: true, controller: 'agent_verifier', plan_id: 'plan-one', plan_hash: hash,
      fallback: false, remote_status: 200, response: { ok: true,
        url: 'https://example.test/receipt?code=private#token', title: 'Current page' } };
    const result = { ok: true, all_steps_succeeded: true, completed_all_steps: true,
      plan_id: 'plan-one', results: [step] };
    expect(cinemaVerifierObservation(result, 'plan-one', hash)).toEqual({
      url: 'https://example.test/receipt', title: 'Current page',
    });
    for (const patch of [{ all_steps_succeeded: false }, { completed_all_steps: false },
      { plan_id: 'other-plan' }, { results: [] }, { results: [{ ...step, controller: 'agent_executor' }] },
      { results: [{ ...step, plan_hash: 'b'.repeat(64) }] }, { results: [{ ...step, fallback: true }] },
      { results: [{ ...step, response: { ok: false, url: 'https://example.test' } }] }]) {
      expect(cinemaVerifierObservation({ ...result, ...patch }, 'plan-one', hash)).toBeNull();
    }
  });

  it('lists existing Cinema plan-bound capabilities with correct risk', () => {
    const contracts = cinemaAgentToolContracts('node.cinema-remote');
    expect(contracts.map(tool => tool.name)).toEqual([
      'browser.remote.read', 'browser.remote.connect', 'browser.remote.execute',
    ]);
    expect(contracts.map(tool => tool.risk)).toEqual(['read', 'high', 'high']);
    expect(contracts.every(tool => tool.target === 'node.cinema-remote')).toBe(true);
  });

  it('builds only read-only Agent Verifier actions bound to an actual Workroom plan', () => {
    expect(cinemaVerifierKind(undefined)).toBe('browser.extract');
    expect(cinemaVerifierKind('browser.screenshot')).toBe('browser.screenshot');
    for (const bad of ['browser.navigate', 'browser.click', 'keyboard.type', null, {}]) {
      expect(() => cinemaVerifierKind(bad)).toThrow('CINEMA_VERIFIER_KIND_DENIED');
    }
    expect(cinemaVerifierReadPayload('web-plan', 'dsg-web-workroom', 'browser.extract')).toEqual({
      action: 'browser.remote.read',
      arguments: {
        plan_id: 'web-plan', agent_identity: 'dsg-web-workroom', stop_on_success: true,
        steps: [{ step_id: 'verify-page', action: {
          kind: 'browser.extract', controller: 'agent_verifier', parameters: {},
        } }],
      },
    });
    expect(() => cinemaVerifierReadPayload('', 'dsg-web-workroom', 'browser.extract')).toThrow('CINEMA_PLAN_OR_AGENT_REQUIRED');
  });

  it('uses existing Workroom routes and account-bound human viewer, never a fake controller', () => {
    const workroom = readFileSync('components/dsg-live-workroom.tsx', 'utf8');
    const viewer = readFileSync('components/dsg-cinema-oauth-viewer.tsx', 'utf8');
    expect(workroom).toContain('...cinemaAgentToolContracts(browserTarget)');
    expect(workroom).toContain('await browserVerifier(cinemaVerifierKind(action.arguments.kind))');
    expect(workroom).toContain('await browserNavigate(action.arguments.url)');
    expect(workroom).toContain('Agent Verifier · ภาพหน้าจอ');
    expect(workroom).toContain("selectTool('browser')");
    expect(viewer).toContain("callCinema('/viewer')");
  });

  it('shows which DSG identity or Cinema binding failed without another silent login redirect', () => {
    expect(describeCinemaAccountIssue('CINEMA_FREE_ACCOUNT_NOT_LINKED')).toContain('ไม่ต้องล็อกอิน Google ซ้ำ');
    expect(describeCinemaAccountIssue('SITE_MEMBERSHIP_OR_SIGNER_UNAVAILABLE')).toContain('Signing Key');
    expect(describeCinemaAccountIssue('SAME_ACCOUNT_BROWSER_VIEWER_NOT_READY')).toContain('Remote ON');
  });
});

