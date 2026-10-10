import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { classifyAuth0SessionFailure } from '@/lib/dsg/user-bound/oauth-refresh';

const bridge = readFileSync(join(process.cwd(), 'app/dsg/autonomous-level/identity-bridge.tsx'), 'utf8');

describe('DSG memory-only Auth0 token renewal without reconnect loop', () => {
  it('opts into rotating refresh token instead of hidden iframe fallback', () => {
    expect(bridge).toContain("scope: 'openid profile email dsg.use offline_access'");
    expect(bridge).toContain('useRefreshTokens: true');
    expect(bridge).toContain('useRefreshTokensFallback: false');
    expect(bridge).toContain("cacheLocation: 'memory'");
    expect(bridge).not.toContain("cacheLocation: 'localstorage'");
    expect(bridge).not.toContain('localStorage.setItem');
    expect(bridge).not.toContain('sessionStorage.setItem');
  });

  it('never auto-redirects on refresh failure or treats a linked subject as a live token', () => {
    expect(bridge).toContain("setStatus('AUTH0_REAUTH_REQUIRED')");
    expect(bridge).toContain('setTokenReady(authenticated)');
    expect(bridge).toContain('disabled={busy || e2eBusy || !tokenReady');
    expect(bridge.match(/loginWithRedirect\(/g)).toHaveLength(1);
    expect(bridge).toContain('async function connect()');
    expect(bridge).not.toContain('window.location.assign(');
    expect(bridge).not.toContain('setTimeout(');
  });

  it('classifies a revoked/missing refresh token without leaking provider messages', () => {
    expect(classifyAuth0SessionFailure(new Error('AUTH0_NO_DELEGATED_TOKEN'))).toBe('AUTH0_REFRESH_NOT_AVAILABLE');
    for (const error of ['invalid_grant', 'missing_refresh_token', 'login_required', 'consent_required']) {
      expect(classifyAuth0SessionFailure({ error, error_description: 'secret-value' }))
        .toBe('AUTH0_REFRESH_NOT_AVAILABLE');
    }
    expect(classifyAuth0SessionFailure({ error: 'network_error', error_description: 'secret-value' }))
      .toBe('AUTH0_IDENTITY_UNAVAILABLE');
    expect(classifyAuth0SessionFailure(new Error('token=secret-value')))
      .toBe('AUTH0_IDENTITY_UNAVAILABLE');
  });

  it('preserves delegated audience and authorization gates', () => {
    expect(bridge).toContain("audience: 'https://aws.dsg.pics'");
    expect(bridge).toContain("body: JSON.stringify({ accessToken, tool: toolName, arguments: {} })");
    expect(bridge).toContain("if (!response.ok || !body.ok || !body.userPrincipalVerified)");
    expect(bridge).not.toContain('X-DSG-API-Key');
    expect(bridge).not.toContain('DSG_SPACETIME_INTERNAL_API_KEY');
  });
});
