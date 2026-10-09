'use client';

import { createAuth0Client, type Auth0Client } from '@auth0/auth0-spa-js';
import { useEffect, useRef, useState } from 'react';

const callback = 'https://dsg.pics/dsg/autonomous-level';

type LinkResponse = {
  ok?: boolean;
  linked?: boolean;
  actorId?: string;
  auth0Sub?: string;
  principal?: { sub: string; issuer: string; verifiedAt: string } | null;
  error?: string;
};

export default function DsgIdentityBridge() {
  const authClient = useRef<Auth0Client | null>(null);
  const [busy, setBusy] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [status, setStatus] = useState('CHECKING_EXISTING_DSG_SESSION');
  const [actorId, setActorId] = useState<string | null>(null);
  const [auth0Sub, setAuth0Sub] = useState<string | null>(null);
  const [message, setMessage] = useState('Validating the DSG workspace session before requesting Auth0 sign-in.');

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const current = await fetch('/api/dsg/identity/link', {
          credentials: 'include', cache: 'no-store',
        });
        const data = await current.json() as LinkResponse;
        if (!current.ok || !data.ok) {
          if (!cancelled) {
            setStatus('DSG_WORKSPACE_SESSION_REQUIRED');
            setMessage('Sign in to DSG ONE and select a workspace before linking Auth0. No permission has been granted.');
          }
          return;
        }
        if (cancelled) return;
        setActorId(data.actorId ?? null);
        if (data.linked && data.principal) {
          setAuth0Sub(data.principal.sub);
          setStatus('AUTH0_ACCOUNT_LINKED');
          setMessage('An Auth0 subject is bound to the verified DSG actor. Runtime approvals remain separate.');
        } else {
          setStatus('AUTH0_NOT_LINKED');
          setMessage('Use the Auth0 sign-in button to bind this DSG workspace actor to the same tenant used by Spacetime.');
        }

        const client = await createAuth0Client({
          domain: 'dev-kcddqmnusbxxo25s.us.auth0.com',
          clientId: 'mLIAcMEAhuVDaUvzXn8Qo54zj2llFp3X',
          authorizationParams: {
            redirect_uri: callback,
            audience: 'https://aws.dsg.pics',
            scope: 'openid profile email dsg.use',
          },
          cacheLocation: 'memory',
          useRefreshTokens: false,
        });
        if (cancelled) return;
        authClient.current = client;
        setAuthReady(true);
        const params = new URLSearchParams(window.location.search);
        if (params.has('error')) {
          setStatus('AUTH0_LOGIN_DENIED');
          setMessage('Auth0 returned an authentication error. DSG privileges are unchanged.');
          window.history.replaceState(null, '', callback);
          return;
        }
        if (params.has('code') && params.has('state')) {
          await client.handleRedirectCallback();
          window.history.replaceState(null, '', callback);
          setStatus('VERIFYING_DUAL_IDENTITY');
          const accessToken = await client.getTokenSilently();
          const result = await fetch('/api/dsg/identity/link', {
            method: 'POST',
            credentials: 'include',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ accessToken }),
            cache: 'no-store',
          });
          const linked = await result.json() as LinkResponse;
          if (!result.ok || !linked.ok || !linked.linked) {
            setStatus('IDENTITY_LINK_BLOCKED');
            setMessage(linked.error || 'Dual authentication was not verified. No privilege was granted.');
            return;
          }
          setActorId(linked.actorId ?? data.actorId ?? null);
          setAuth0Sub(linked.auth0Sub ?? null);
          setStatus('AUTH0_ACCOUNT_LINKED');
          setMessage('Both signed Auth0 token and Supabase workspace actor were verified and linked by the backend. N2N access remains governed.');
        }
      } catch {
        if (!cancelled) {
          setStatus('IDENTITY_LINK_NOT_VERIFIED');
          setMessage('The identity backend or Auth0 service could not be verified. Existing DSG access remains unchanged.');
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    void start();
    return () => { cancelled = true; };
  }, []);

  async function connect() {
    if (!authClient.current) return;
    setBusy(true);
    setMessage('Redirecting to the shared Auth0 Universal Login (PKCE)...');
    try {
      await authClient.current.loginWithRedirect({
        authorizationParams: { redirect_uri: callback },
      });
    } catch {
      setBusy(false);
      setStatus('AUTH0_REDIRECT_FAILED');
      setMessage('Auth0 redirect could not be started. No account link was written.');
    }
  }

  return (
    <section className="rounded-3xl border border-indigo-500/30 bg-slate-900 p-6 md:p-8" aria-label="DSG SSO account linking">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-200">DSG Identity Hub · Auth0 / Supabase / N2N</p>
      <h2 className="mt-3 text-2xl font-black">Link your DSG principal to Auth0</h2>
      <p className="mt-2 text-sm text-slate-400">This optional link verifies both the existing DSG ONE workspace membership and a signed Auth0 access token. It cannot bypass policy, RBAC or approval.</p>
      <div role="status" aria-live="polite" className="mt-4 rounded-xl border border-slate-700 bg-slate-950 p-4">
        <p className="font-mono text-xs text-indigo-200">{status}</p>
        <p className="mt-2 text-sm text-slate-300">{message}</p>
        <p className="mt-3 break-all font-mono text-xs text-slate-500">DSG actor: {actorId || 'NOT_VERIFIED'}</p>
        <p className="mt-1 break-all font-mono text-xs text-slate-500">Auth0 subject: {auth0Sub || 'NOT_LINKED'}</p>
      </div>
      <button onClick={() => void connect()} disabled={busy || !authReady}
        className="mt-4 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-700">
        {busy ? 'Checking…' : auth0Sub ? 'Re-authenticate with Auth0' : 'Link via Auth0 (PKCE)'}
      </button>
      <p className="mt-3 text-xs text-amber-200">Autonomous Level readout and this account link are not proof that governed N2N execution has succeeded.</p>
    </section>
  );
}
