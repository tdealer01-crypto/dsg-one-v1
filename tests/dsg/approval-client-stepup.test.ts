import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(
  new URL('../../app/dsg/approvals/approval-client.tsx', import.meta.url),
  'utf8',
);

describe('human approval step-up transport', () => {
  it('uses a redirect transaction instead of a popup for mobile-safe MFA', () => {
    expect(SOURCE).toContain('loginWithRedirect');
    expect(SOURCE).toContain("ext_dsg_stepup: '1'");
    expect(SOURCE).toContain('appState: intent');
    expect(SOURCE).not.toContain('getTokenWithPopup');
  });

  it('does not require a second Supabase site session before the Auth0 callback', () => {
    expect(SOURCE).toContain('handleRedirectCallback');
    expect(SOURCE).not.toContain("fetch('/api/dsg/identity/link'");
    expect(SOURCE).not.toContain('siteReady');
  });

  it('keeps the step-up bearer token out of browser storage and URLs', () => {
    expect(SOURCE).toContain('getTokenSilently');
    expect(SOURCE).toContain("cacheLocation: 'memory'");
    expect(SOURCE).toContain("useCookiesForTransactions: true");
    expect(SOURCE).not.toContain('localStorage.setItem');
    expect(SOURCE).not.toContain('sessionStorage.setItem');
  });

  it('does not force primary login or an MFA test before each exact approval', () => {
    expect(SOURCE).toContain("ext_dsg_stepup: '1'");
    expect(SOURCE).not.toContain("prompt: 'login'");
    expect(SOURCE).not.toContain('max_age: 0,');
    expect(SOURCE).toContain("proof.error === 'FRESH_SIGNED_MFA_REQUIRED'");
    expect(SOURCE).toContain("setMfaSessionExpired(true)");
    expect(SOURCE).not.toContain("await startStepUp({ kind: 'approve', approvalRequestId: selected.approval_request_id })");
    expect(SOURCE).toContain("scope: SCOPE, ext_dsg_stepup: '1'");
    expect(SOURCE).toContain("tool('spacetime_resolve_approval'");
    expect(SOURCE).not.toContain('ทดสอบ MFA (ไม่อนุมัติ)</button>');
    expect(SOURCE).toContain('MFA was completed at the first owner login');
  });

  it('keeps the exact request across redirect, without persisting any bearer token', () => {
    expect(SOURCE).toContain('const c = new Auth0Client({');
    expect(SOURCE).toContain('const callback = await c.handleRedirectCallback()');
    expect(SOURCE).toContain('reviewApprovalId = callback.appState.approvalRequestId');
    expect(SOURCE).toContain("CALLBACK + '?approval_request_id=' + encodeURIComponent(reviewApprovalId)");
    expect(SOURCE).toContain('completingStepUpId.current === key');
    expect(SOURCE).not.toContain('localStorage.setItem');
  });
});
