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
  const [status, setStatus] = useState('CHECKING_EXISTING_DSG_SESSION');
  const [actorId, setActorId] = useState<string | null>(null);
  const [auth0Sub, setAuth0Sub] = useState<string | null>(null);
  const [e2eBusy, setE2eBusy] = useState(false);
  const [e2eStatus, setE2eStatus] = useState('USER_BOUND_READ_E2E_NOT_VERIFIED');
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

  async function verifyGovernedRead() {
    if (!authClient.current || !auth0Sub || busy) return;
    setE2eBusy(true);
    setE2eProof(null);
    setE2eStatus('VERIFYING_USER_BOUND_GOVERNED_READ');
    try {
      // The Auth0 SPA SDK retains the user's token in memory only. Never
      // substitute the website session, Site bridge, or owner credential.
      const accessToken = await authClient.current.getTokenSilently();
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
      const decision = read.receipt?.decision as Record<string, unknown> | undefined;
      if (decision?.verdict !== 'ALLOW' || read.receipt?.principal_binding !== 'VERIFIED_OAUTH_SUBJECT' ||
          typeof read.receipt?.plan_hash !== 'string' || !read.receipt?.evidence || !read.receipt?.result) {
        throw new Error('GOVERNED_PROVIDER_READ_NOT_VERIFIED');
      }
      const chain = await tool('spacetime_verify_evidence');
      if (!chain.evidenceVerified || chain.receipt?.valid !== true) {
        throw new Error('EVIDENCE_CHAIN_INVALID_OR_UNAVAILABLE');
      }
      const receipt = read.receipt.evidence as Record<string, unknown>;
      // The read proves a delegated principal-bound provider operation and
      // evidence-chain integrity, not an approval-required or mobile MCP flow.
      setE2eProof(JSON.stringify({
        plan_hash: read.receipt.plan_hash,
        route_id: read.receipt.route_id,
        decision: decision.verdict,
        evidence_hash: receipt.hash ?? receipt.record_hash ?? null,
        evidence_chain_valid: true,
        auth0_principal: 'VERIFIED_USER_SUBJECT',
      }, null, 2));
      setE2eStatus('USER_BOUND_READ_E2E_VERIFIED');
    } catch (error) {
      setE2eStatus('USER_BOUND_READ_E2E_BLOCKED');
      setE2eProof(error instanceof Error ? error.message : 'UNVERIFIED');
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
        {busy ? 'Checking…' : auth0Sub ? 'Re-authenticate with Auth0' : 'Link via Auth0 (PKCE)'}
      </button>
      <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-950 p-4">
        <p className="text-sm font-bold text-indigo-200">User-bound AWS Spacetime E2E — read only</p>
        <p className="mt-2 text-xs leading-5 text-slate-400">
          Calls the existing production read-only public repository route with your verified Auth0 subject.
          AWS creates and executes its own plan, then verifies the evidence chain. This does not approve mutations.
        </p>
        <button onClick={() => void verifyGovernedRead()} disabled={busy || e2eBusy || !auth0Sub || !authReady}
          className="mt-4 rounded-xl border border-indigo-400/50 px-4 py-2 text-sm font-bold text-indigo-200 disabled:opacity-40">
          {e2eBusy ? 'Verifying…' : 'Run user-bound governed read E2E'}
        </button>
        <p role="status" className="mt-3 font-mono text-xs text-amber-200">{e2eStatus}</p>
        {e2eProof && <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs text-slate-300">{e2eProof}</pre>}
      </div>
      <p className="mt-3 text-xs text-amber-200">Autonomous Level readout and this account link are not proof that governed N2N execution has succeeded.</p>
    </section>
  );
}
