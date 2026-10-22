import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { cinemaAgentToolContracts, cinemaVerifierKind, cinemaVerifierReadPayload } from '@/lib/dsg/user-bound/cinema-controller-contract';
import { describeCinemaAccountIssue } from '@/components/dsg-cinema-oauth-viewer';

describe('DSG Cinema multi-controller Agent menu', () => {
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
