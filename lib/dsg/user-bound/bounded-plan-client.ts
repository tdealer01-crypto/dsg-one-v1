'use client';

import { Auth0Client } from '@auth0/auth0-spa-js';
import { asRecord, type JsonRecord } from './workroom-contract';

export type BoundedOperation = 'stage' | 'view' | 'confirm' | 'status' | 'revoke';
let approver: Auth0Client | null = null;

// The same dedicated human approver identity as the existing approvals page.
// A popup keeps the reviewed plan in memory; it never stores a bearer in a URL.
export function getBoundedApproverSession() {
  approver ??= new Auth0Client({
    domain: 'dev-kcddqmnusbxxo25s.us.auth0.com',
    clientId: 'jI1uiKcQu7mqORsaCrogKTQVsAcZuQSt',
    authorizationParams: { redirect_uri: 'https://dsg.pics/dsg/approvals',
      audience: 'https://aws.dsg.pics', scope: 'openid profile email dsg.approve' },
    cacheLocation: 'memory', useCookiesForTransactions: true, useRefreshTokens: false,
  });
  return approver;
}

export async function boundedPlanRequest(operation: BoundedOperation, accessToken: string,
  args: JsonRecord): Promise<JsonRecord> {
  let response: Response;
  try {
    response = await fetch('/api/dsg/bounded-plans', {
      method: 'POST', credentials: 'include', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation, accessToken, arguments: args }),
    });
  } catch {
    throw new Error(operation === 'confirm' ? 'BOUNDED_PLAN_CONFIRMATION_UNCERTAIN' : 'BOUNDED_PLAN_UNAVAILABLE');
  }
  const body = asRecord(await response.json().catch(() => null));
  const receipt = asRecord(body?.receipt);
  if (!response.ok || body?.ok !== true || body.userPrincipalVerified !== true || !receipt) {
    // Fixed server codes only; never display arbitrary upstream content or tokens.
    const code = typeof body?.error === 'string' && /^[A-Z0-9_]{3,100}$/.test(body.error)
      ? body.error : 'BOUNDED_PLAN_UNAVAILABLE';
    throw new Error(code);
  }
  return receipt;
}
