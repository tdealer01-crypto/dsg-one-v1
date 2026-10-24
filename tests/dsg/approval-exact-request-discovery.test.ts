import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ui = readFileSync(join(process.cwd(), 'app/dsg/approvals/approval-client.tsx'), 'utf8');

describe('DSG exact-request human approval UX', () => {
  it('loads the real owner-scoped queue once after Auth0 login', () => {
    expect(ui).toContain("initialListLoaded.current = true");
    expect(ui).toContain("tool('spacetime_list_pending_approvals', {})");
    expect(ui).toContain('!tokenReady || requestedApprovalId || pendingStepUpIntent');
    expect(ui).toContain('ไม่พบคำขอที่รออนุมัติในบัญชี Auth0 นี้');
  });

  it('accepts an exact request ID for a Workroom or chat handoff without bypassing auth', () => {
    expect(ui).toContain('function openExactApproval()');
    expect(ui).toContain('isValidApprovalRequestId(id)');
    expect(ui).toContain("CALLBACK + '?approval_request_id=' + encodeURIComponent(id)");
    expect(ui).toContain('setRequestedApprovalId(id)');
    expect(ui).toContain("tool('spacetime_get_approval'");
    expect(ui).not.toContain('localStorage.setItem');
    expect(ui).not.toContain('sessionStorage.setItem');
  });

  it('fails visibly for an expired request rather than approving stale evidence', () => {
    expect(ui).toContain("decision === 'APPROVE' && selected.expires_at");
    expect(ui).toContain('expiry <= Date.now()');
    expect(ui).toContain('APPROVAL_EXPIRED');
  });

  it('preserves signed MFA, exact-request review and deny capability', () => {
    expect(ui).toContain("ext_dsg_stepup: '1'");
    expect(ui).toContain("tool('spacetime_resolve_approval'");
    expect(ui).toContain("decision === 'APPROVE' && selected.risk_tier === 'high'");
    expect(ui).toContain("onClick={() => void decide('REJECT')}");
  });
  it('does not automatically redirect exact requests into a mobile Auth0 login loop', () => {
    expect(ui).not.toContain("!authenticated && reviewApprovalId && !(params.has('code') && params.has('state'))");
    expect(ui).toContain("if (!authenticated && reviewApprovalId)");
    expect(ui).toContain("appState = isValidApprovalRequestId(queryApprovalId)");
    expect(ui).toContain("await client.current.loginWithRedirect({");
    expect(ui).toContain("useCookiesForTransactions: true");
    expect(ui).toContain("cacheLocation: 'memory'");
    expect(ui).not.toContain("decision: 'APPROVE', approvalRequestId: reviewApprovalId");
    expect(ui).not.toContain("localStorage.setItem");
    expect(ui).not.toContain("sessionStorage.setItem");
  });

});
