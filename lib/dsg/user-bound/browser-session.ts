'use client';

import { Auth0Client } from '@auth0/auth0-spa-js';

export const DSG_AUTH0_CALLBACK = 'https://dsg.pics/dsg/autonomous-level';
let session: Auth0Client | null = null;
let redirect: ReturnType<Auth0Client['handleRedirectCallback']> | null = null;

// Share only the agent-class SDK instance during Next.js client navigation.
// Tokens remain in SDK memory. Human approval uses its separate client.
export function getDsgBrowserSession(): Auth0Client {
  session ??= new Auth0Client({
    domain: 'dev-kcddqmnusbxxo25s.us.auth0.com',
    clientId: 'mLIAcMEAhuVDaUvzXn8Qo54zj2llFp3X',
    authorizationParams: {
      redirect_uri: DSG_AUTH0_CALLBACK,
      audience: 'https://aws.dsg.pics',
      scope: 'openid profile email dsg.use offline_access',
    },
    cacheLocation: 'memory',
    useRefreshTokens: true,
    useRefreshTokensFallback: false,
  });
  return session;
}

export function finishDsgBrowserRedirect() {
  redirect ??= getDsgBrowserSession().handleRedirectCallback();
  return redirect;
}
