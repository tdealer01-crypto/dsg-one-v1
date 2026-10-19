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
    expect(SOURCE).toContain('the bearer token remains in memory');
    expect(SOURCE).not.toContain('localStorage.setItem');
    expect(SOURCE).not.toContain('sessionStorage.setItem');
  });
});
