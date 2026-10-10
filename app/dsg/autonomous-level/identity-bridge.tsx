'use client';

import { createAuth0Client, type Auth0Client } from '@auth0/auth0-spa-js';
import { useEffect, useRef, useState } from 'react';
import { verifiedGovernedReadProof } from '@/lib/dsg/user-bound/read-proof';
import { classifyAuth0SessionFailure } from '@/lib/dsg/user-bound/oauth-refresh';

const callback = 'https://dsg.pics/dsg/autonomous-level';

type LinkResponse = {
  ok?: boolean;
  linked?: boolean;
  actorId?: string;
  auth0Sub?: string;
  workspaceRole?: 'OWNER' | 'ADMIN' | 'OPERATOR' | 'AUDITOR' | 'VIEWER';
  principal?: { sub: string; issuer: string; verifiedAt: string } | null;
  error?: string;
};
type ToolBridgeResponse = {
  ok?: boolean;
  error?: string;
  receipt?: Record<string, unknown>;
  evidenceVerified?: boolean;
  userPrincipalVerified?: boolean;
};

export default function DsgIdentityBridge() {
  const authClient = useRef<Auth0Client | null>(null);
  const [busy, setBusy] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [tokenReady, setTokenReady] = useState(false);
  const [status, setStatus] = useState('CHECKING_EXISTING_DSG_SESSION');
  const [actorId, setActorId] = useState<string | null>(null);
  const [auth0Sub, setAuth0Sub] = useState<string | null>(null);
  const [workspaceRole, setWorkspaceRole] = useState<LinkResponse['workspaceRole']>(undefined);
  const [e2eBusy, setE2eBusy] = useState(false);
  const [e2eStatus, setE2eStatus] = useState<'PASS' | 'REVIEW' | 'BLOCKED'>('REVIEW');
  const [e2eNextAction, setE2eNextAction] = useState('Sign in to DSG ONE, verify Auth0, and run a governed read only with an eligible workspace role.');
  const [e2eProof, setE2eProof] = useState<string | null>(null);
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
        setWorkspaceRole(data.workspaceRole);
        if (data.linked && data.principal) {
          setAuth0Sub(data.principal.sub);
          setStatus('AUTH0_ACCOUNT_LINKED');
          setMessage('An Auth0 subject is bound to the verified DSG actor. A fresh delegated token is still required after reopening this page.');
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
            scope: 'openid profile email dsg.use offline_access',
          },
          cacheLocation: 'memory',
          useRefreshTokens: true,
          useRefreshTokensFallback: false,
        });
        if (cancelled) return;
        authClient.current = client;
        setAuthReady(true);
        const params = new URLSearchParams(window.location.search);
        if (params.has('error')) {
          setStatus('AUTH0_LOGIN_DENIED');
          setTokenReady(false);
          setMessage('Auth0 returned an authentication error. Use the sign-in button once; no automatic redirect will be triggered. DSG privileges are unchanged.');
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
          setWorkspaceRole(linked.workspaceRole ?? data.workspaceRole);
          setTokenReady(true);
          setStatus('AUTH0_ACCOUNT_LINKED');
          setMessage('Auth0 token verified for this session. The SDK refreshes through a rotating refresh token when the Auth0 client allows offline_access. N2N remains governed.');
        } else {
          // Linked account != live delegated authorization. Never present a stored
          // Auth0 subject as an authenticated connector/session after a reload.
          const authenticated = await client.isAuthenticated();
          setTokenReady(authenticated);
          if (!authenticated && data.linked) {
            setStatus('AUTH0_REAUTH_REQUIRED');
            setMessage('Your DSG identity remains linked but this browser has no usable delegated Auth0 token. Select Re-authenticate once. Automatic redirect loops are disabled.');
          }
        }
      } catch (error) {
        if (!cancelled) {
          setTokenReady(false);
          const reason = classifyAuth0SessionFailure(error);
          setStatus(reason === 'AUTH0_REFRESH_NOT_AVAILABLE' ? 'AUTH0_REAUTH_REQUIRED' : 'IDENTITY_LINK_NOT_VERIFIED');
          setMessage(reason === 'AUTH0_REFRESH_NOT_AVAILABLE'
            ? 'Auth0 session renewal is unavailable or revoked. Re-authenticate once; never retry redirects automatically.'
            : 'The identity backend or Auth0 service could not be verified. Existing DSG access remains unchanged.');
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
    // A failed redirect must not revoke a still-valid memory-only token.
    setMessage('Redirecting to the shared Auth0 Universal Login (PKCE) once, at your request...');
    try {
      await authClient.current.loginWithRedirect({
        authorizationParams: { redirect_uri: callback },
      });
    } catch {
      setBusy(false);
      setStatus('AUTH0_REDIRECT_FAILED');
      setMessage('Auth0 redirect could not be started. Existing valid delegated tokens remain usable; no account link was written.');
    }
  }

  async function verifyGovernedRead() {
    if (!authClient.current || !auth0Sub || busy || !workspaceRole || workspaceRole === 'VIEWER') return;
    setE2eBusy(true);
    setE2eProof(null);
    setE2eStatus('REVIEW');
    setE2eNextAction('Wait for the exact AWS provider receipt and independently checked evidence chain.');
    try {
      // The Auth0 SPA SDK retains the user's token in memory only. Never
      // substitute the website session, Site bridge, or owner credential.
      // The SDK refreshes short-lived access tokens using its memory-only
      // refresh-token cache. No JWT or refresh token is persisted by DSG.
      let accessToken: string;
      try {
        const candidate = await authClient.current.getTokenSilently();
        if (typeof candidate !== 'string' || candidate.length === 0) {
          throw new Error('AUTH0_NO_DELEGATED_TOKEN');
        }
        accessToken = candidate;
      } catch (error) {
        setTokenReady(false);
        if (classifyAuth0SessionFailure(error) === 'AUTH0_REFRESH_NOT_AVAILABLE') {
          setStatus('AUTH0_REAUTH_REQUIRED');
          setMessage('The delegated Auth0 token could not be renewed. Resume the session once with the Auth0 button; the existing DSG account link is preserved.');
          throw new Error('AUTH0_REAUTH_REQUIRED');
        }
        setStatus('AUTH0_TOKEN_UNAVAILABLE');
        setMessage('The Auth0 delegated token is unavailable. Check the existing Auth0 application configuration and connectivity; repeated login attempts will not repair invalid_client.');
        throw new Error('AUTH0_DELEGATED_TOKEN_UNAVAILABLE');
      }
      async function tool(toolName: string): Promise<ToolBridgeResponse> {
        const response = await fetch('/api/dsg/spacetime/user-tools', {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ accessToken, tool: toolName, arguments: {} }),
        });
        const body = await response.json() as ToolBridgeResponse;
        if (!response.ok || !body.ok || !body.userPrincipalVerified) {
          throw new Error(body.error ?? 'GOVERNED_TOOL_NOT_VERIFIED');
        }
        return body;
      }
      const read = await tool('spacetime_read_public_repo');
      const chain = await tool('spacetime_verify_evidence');
      const proof = verifiedGovernedReadProof(read, chain);
      if (!proof) throw new Error('GOVERNED_PROVIDER_EVIDENCE_BINDING_NOT_VERIFIED');
      // PASS proves only this user-initiated, no-approval read and its hashed
      // evidence. It does not grant approval for future provider mutations.
      setE2eProof(JSON.stringify(proof, null, 2));
      setE2eStatus('PASS');
      setE2eNextAction('The read-only provider proof passed. Request a separately bound human approval before any protected write.');
    } catch (error) {
      setE2eStatus('BLOCKED');
      setE2eProof(error instanceof Error ? error.message : 'UNVERIFIED');
      setE2eNextAction('Check the DSG workspace role, memory-only Auth0 session, and AWS MCP receipt. Retry only after the reported failure is resolved.');
    } finally {
      setE2eBusy(false);
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
        {busy ? 'Checking…' : tokenReady ? 'Re-authenticate with Auth0' : auth0Sub ? 'Resume Auth0 session (PKCE)' : 'Link via Auth0 (PKCE)'}
      </button>
      <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-950 p-4">
        <p className="text-sm font-bold text-indigo-200">User-bound AWS Spacetime E2E — read only</p>
        <p className="mt-2 text-xs leading-5 text-slate-400">
          Calls the existing production read-only public repository route with your verified Auth0 subject.
          AWS creates and executes its own plan, then verifies the evidence chain. This does not approve mutations.
        </p>
        <button onClick={() => void verifyGovernedRead()} disabled={busy || e2eBusy || !tokenReady || !auth0Sub || !authReady || !workspaceRole || workspaceRole === 'VIEWER'}
          className="mt-4 rounded-xl border border-indigo-400/50 px-4 py-2 text-sm font-bold text-indigo-200 disabled:opacity-40">
          {e2eBusy ? 'Verifying…' : 'Run user-bound governed read E2E'}
        </button>
        <p role="status" className="mt-3 font-mono text-xs text-amber-200">{e2eStatus}</p>
        <p className="mt-2 text-xs text-slate-300">Next action: {workspaceRole === 'VIEWER' ? 'Ask your workspace administrator for the replay:verify permission. No provider read has been started.' : e2eNextAction}</p>
        {e2eProof && <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs text-slate-300">{e2eProof}</pre>}
      </div>
      <p className="mt-3 text-xs text-slate-400">Refresh is automatic while this browser session retains its memory-only token and the Auth0 client allows rotating refresh tokens. Closing/reloading the page or revoking the grant may require one explicit sign-in. The ChatGPT plugin connection is separate.</p>
      <p className="mt-3 text-xs text-amber-200">Autonomous Level readout and this account link are not proof that governed N2N execution has succeeded.</p>
    </section>
  );
}
