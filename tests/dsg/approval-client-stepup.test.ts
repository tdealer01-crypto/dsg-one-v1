import { readFileSync } from 'node:fs';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ApprovalClient from '@/app/dsg/approvals/approval-client';

const auth = vi.hoisted(() => ({
  options: [] as Record<string, unknown>[],
  effects: [] as (() => unknown)[],
  status: vi.fn(),
  authenticated: vi.fn(),
  callback: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('@auth0/auth0-spa-js', () => ({
  Auth0Client: class {
    constructor(options: Record<string, unknown>) { auth.options.push(options); }
    isAuthenticated = auth.authenticated;
    handleRedirectCallback = auth.callback;
    loginWithRedirect = auth.redirect;
  },
}));

vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useCallback: (callback: unknown) => callback,
    useEffect: (effect: () => unknown) => { auth.effects.push(effect); },
    useRef: (value: unknown) => ({ current: value }),
    useState: (value: unknown) => [value,
      value === 'กำลังตรวจสอบเซสชัน Auth0 สำหรับการอนุมัติ' ? auth.status : vi.fn()],
  };
});

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
    expect(SOURCE).not.toContain('localStorage.setItem');
    expect(SOURCE).not.toContain('sessionStorage.setItem');
  });

  it('does not force primary login or an MFA test before each exact approval', () => {
    expect(SOURCE).toContain("ext_dsg_stepup: '1'");
    expect(SOURCE).not.toContain("prompt: 'login'");
    expect(SOURCE).not.toContain('max_age: 0,');
    expect(SOURCE).toContain("proof.error === 'FRESH_SIGNED_MFA_REQUIRED'");
    expect(SOURCE).toContain("tool('spacetime_resolve_approval'");
    expect(SOURCE).not.toContain('ทดสอบ MFA (ไม่อนุมัติ)</button>');
    expect(SOURCE).toContain('signed MFA');
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

describe('approval login initialization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.options.length = 0;
    auth.effects.length = 0;
    auth.authenticated.mockResolvedValue(false);
    auth.callback.mockResolvedValue({});
    auth.redirect.mockResolvedValue(undefined);
    vi.stubGlobal('React', React);
    vi.stubGlobal('window', {
      location: { search: '?approval_request_id=dsg_apreq_test' },
      history: { replaceState: vi.fn() },
    });
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  function initialize() {
    const tree = ApprovalClient();
    auth.effects[0]();
    return tree;
  }

  it('persists only the SDK PKCE transaction in host-scoped cookies, keeping tokens in memory', async () => {
    initialize();
    await vi.waitFor(() => expect(auth.authenticated).toHaveBeenCalledOnce());
    expect(auth.options[0]).toMatchObject({
      cacheLocation: 'memory', useCookiesForTransactions: true, useRefreshTokens: false,
    });
    expect(auth.options[0]).not.toHaveProperty('cookieDomain');
  });

  it('waits for deliberate sign-in when a signed-out user opens an exact request link', async () => {
    initialize();
    await vi.waitFor(() => expect(auth.status).toHaveBeenCalledWith(
      'คำขอพร้อมตรวจแล้ว · กดยืนยันตัวตนหนึ่งครั้งเพื่อดูงานนี้',
    ));
    expect(auth.redirect).not.toHaveBeenCalled();
    expect(auth.callback).not.toHaveBeenCalled();
  });

  it('preserves the exact request across a successful callback without redirecting again', async () => {
    window.location.search = '?code=synthetic-code&state=synthetic-state';
    auth.callback.mockResolvedValue({ appState: { kind: 'review', approvalRequestId: 'dsg_apreq_restored' } });
    auth.authenticated.mockResolvedValue(true);
    initialize();
    await vi.waitFor(() => expect(auth.status).toHaveBeenCalledWith(
      'เข้าสู่ระบบ Auth0 แล้ว พร้อมตรวจรายการรออนุมัติ',
    ));
    expect(window.history.replaceState).toHaveBeenCalledWith(null, '',
      'https://dsg.pics/dsg/approvals?approval_request_id=dsg_apreq_restored');
    expect(auth.callback).toHaveBeenCalledOnce();
    expect(auth.redirect).not.toHaveBeenCalled();
  });

  it('clears a failed callback and leaves a deliberate retry instead of another redirect', async () => {
    window.location.search = '?approval_request_id=dsg_apreq_test&code=synthetic-code&state=synthetic-state';
    auth.callback.mockRejectedValue({ code: 'invalid_state' });
    initialize();
    await vi.waitFor(() => expect(auth.status).toHaveBeenCalledWith(
      expect.stringContaining('AUTH0_CALLBACK_TRANSACTION_LOST'),
    ));
    expect(window.history.replaceState).toHaveBeenCalledWith(null, '',
      'https://dsg.pics/dsg/approvals?approval_request_id=dsg_apreq_test');
    expect(auth.redirect).not.toHaveBeenCalled();
    expect(auth.authenticated).not.toHaveBeenCalled();
  });
});
