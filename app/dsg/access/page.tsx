'use client';

import { useCallback, useEffect, useState } from 'react';
import { CircleCheck, ExternalLink, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';

type Membership = { workspace_id: string; role: 'OWNER' | 'ADMIN' | 'OPERATOR' | 'AUDITOR' | 'VIEWER' };
type SessionPayload = {
  ok: boolean;
  actor?: { id: string; email: string | null };
  memberships?: Membership[];
  selected?: Membership | null;
  error?: string;
};
type RuntimeStatus = { ok?: boolean; version?: string; env?: string; ts?: string };
type IntegrationStatus = {
  authority: string;
  user_oauth_e2e: string;
  provider_execution_e2e: string;
  surfaces: { workroom: { state: string }; goal_first_lab: { state: string }; execution_evidence: { state: string }; spacetime: { state: string }; dsg_one: { state: string } };
};

const toolCards: Array<{
  name: string;
  description: string;
  href: string | null;
  badge: string;
}> = [
  {
    name: 'App Builder',
    description: 'Open the existing DSG ONE app-builder workspace. Runtime execution still requires its normal governance gates.',
    href: '/dsg/app-builder',
    badge: 'Authenticated AWS app',
  },
  {
    name: 'Governance Controls',
    description: 'Inspect the DSG governance control catalog. A catalog view is not evidence that an execution passed.',
    href: '/dsg/governance',
    badge: 'Control catalog',
  },
  {
    name: 'Runtime Health',
    description: 'Inspect the live DSG ONE application status. App health does not establish Cinema or Spacetime execution readiness.',
    href: '/api/agent/status',
    badge: 'Read only',
  },
  {
    name: 'User-bound Auth0 Bridge',
    description: 'Connect the existing DSG ONE workspace actor to the verified Auth0 subject, then perform a governed, read-only Spacetime proof with evidence. Never uses Site/Owner credentials.',
    href: '/dsg/autonomous-level',
    badge: 'Signed-in user · OAuth governed',
  },
  {
    name: 'Spacetime MCP',
    description: 'OAuth-protected API: https://aws.dsg.pics/mcp. Use an authenticated MCP client; a browser request without a token returns 401.',
    href: null,
    badge: 'Connector only',
  },
  {
    name: 'Workroom',
    description: 'Open the native AWS operator Workroom. Website authentication and workspace membership are required; agent chat is context and planning, while Spacetime remains execution authority.',
    href: '/dsg/workroom',
    badge: 'Authenticated AWS workroom',
  },
  {
    name: 'Cinema / Browser',
    description: 'Open the verified public AWS Cinema surface. Browser status/action still requires its API-key and approval boundaries; reachability is not execution evidence.',
    href: 'https://aws.dsg.pics/app',
    badge: 'Public AWS · execution gated',
  },
  {
    name: 'Agent v0 / NVIDIA Skills',
    description: 'Open the private-owner Kaggle NVIDIA T4x2 worker notebook. Agent v0 remains proposal-only behind DSG Spacetime; the notebook is ephemeral and must pass its live health/plan proof before it is treated as available. Free-only mode fails closed instead of falling back to a paid GPU provider.',
    href: 'https://www.kaggle.com/code/taraaaa1111/dsg-agent-v0-qwen3-30b-a3b-t4x2',
    badge: 'Free Kaggle GPU · proposal',
  },
  {
    name: 'Agent Repair',
    description: 'Repair proposals are not executable authority. Governed runtime binding and result evidence must be verified before offering a direct action.',
    href: null,
    badge: 'Proposal only',
  },
];

export default function DsgAccessPage() {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationStatus | null>(null);
  const [busyWorkspace, setBusyWorkspace] = useState<string | null>(null);
  const [message, setMessage] = useState('Loading authenticated DSG session…');

  const load = useCallback(async () => {
    const [sessionResponse, runtimeResponse] = await Promise.all([
      fetch('/api/dsg/access/session', { cache: 'no-store', credentials: 'include' }),
      fetch('/api/agent/status', { cache: 'no-store' }),
    ]);
    if (sessionResponse.status === 401) {
      window.location.assign('/login?next=/dsg/access');
      return;
    }
    const nextSession = await sessionResponse.json() as SessionPayload;
    setSession(nextSession);
    if (runtimeResponse.ok) setRuntime(await runtimeResponse.json() as RuntimeStatus);
    if (nextSession.selected) {
      try {
        const integrationResponse = await fetch('/api/dsg/integrations/status', { cache: 'no-store', credentials: 'include' });
        setIntegrations(integrationResponse.ok ? await integrationResponse.json() as IntegrationStatus : null);
      } catch {
        setIntegrations(null);
      }
    } else {
      setIntegrations(null);
    }
    setMessage(nextSession.selected ? 'Authenticated DSG session is ready.' : 'Select a workspace to activate governed access.');
  }, []);

  const selectWorkspace = useCallback(async (workspaceId: string) => {
    setBusyWorkspace(workspaceId);
    const response = await fetch('/api/dsg/access/workspace', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspaceId }),
      credentials: 'include',
    });
    const payload = await response.json() as { ok?: boolean; error?: string };
    setBusyWorkspace(null);
    if (!response.ok || !payload.ok) {
      setMessage(payload.error ?? 'Workspace activation failed.');
      return;
    }
    await load();
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!session || session.selected || session.memberships?.length !== 1 || busyWorkspace) return undefined;
    const workspaceId = session.memberships[0].workspace_id;
    const timer = window.setTimeout(() => {
      void selectWorkspace(workspaceId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [session, busyWorkspace, selectWorkspace]);

  async function signOut() {
    await fetch('/api/auth/session', { method: 'DELETE', credentials: 'include' });
    window.location.assign('/login?next=/dsg/access');
  }

  const selected = session?.selected ?? null;

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-slate-100 md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 rounded-[2rem] border border-slate-800 bg-slate-900/80 p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">
              <ShieldCheck className="h-3.5 w-3.5" /> DSG ONE Product Access
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">One authenticated entry point.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              Email login establishes a Supabase-backed DSG session. Workspace membership controls access; provider credentials must remain server-side. MCP authorization through Auth0 is separate from this website session.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold text-slate-200 hover:border-slate-500">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <button onClick={() => void signOut()} className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 px-4 py-2 text-sm font-bold text-red-200 hover:bg-red-500/10">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </header>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Authenticated actor</div>
            <div className="mt-3 text-lg font-bold text-white">{session?.actor?.email ?? 'Loading…'}</div>
            <div className="mt-1 break-all font-mono text-xs text-slate-500">{session?.actor?.id ?? '—'}</div>
            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">{message}</div>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Runtime</div>
                <div className="mt-2 text-xl font-black">{runtime?.ok ? 'APP HEALTHY' : 'CHECKING'}</div>
              </div>
              {runtime?.ok && <CircleCheck className="h-8 w-8 text-emerald-400" />}
            </div>
            <div className="mt-3 font-mono text-xs text-slate-500">{runtime?.version ?? 'version pending'}</div>
            <a className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-indigo-300 hover:text-indigo-200" href="/api/agent/status" target="_blank" rel="noreferrer">
              Open runtime status <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Unified DSG integration status</div>
          <h2 className="mt-2 text-2xl font-black">One system, separate verified identities</h2>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">
            Goal-first Lab and Execution Evidence are companion ChatGPT app surfaces. Workroom and AWS Spacetime are the existing runtime.
            A green network check never means user OAuth, an approved execution, or evidence verification passed.
          </p>
          {integrations ? (
            <>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {([
                  ['DSG ONE', integrations.surfaces.dsg_one.state],
                  ['AWS Spacetime metadata', integrations.surfaces.spacetime.state],
                  ['Workroom session', integrations.surfaces.workroom.state],
                  ['Goal-first Lab', integrations.surfaces.goal_first_lab.state],
                  ['Execution Evidence', integrations.surfaces.execution_evidence.state],
                ] as const).map(([name, state]) => (
                  <div key={name} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <div className="text-sm font-bold text-slate-200">{name}</div>
                    <div className="mt-2 break-words font-mono text-xs text-indigo-300">{state}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                User OAuth E2E: {integrations.user_oauth_e2e} · Provider execution E2E: {integrations.provider_execution_e2e}.
                Never substitute Site/Owner service credentials for the signed-in user&apos;s Auth0 identity.
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-slate-400">Select an authenticated workspace to run the read-only integration checks.</p>
          )}
        </section>

        <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Workspace authority</div>
              <h2 className="mt-2 text-2xl font-black">Select the governed workspace</h2>
            </div>
            {selected && <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-bold text-emerald-200">ACTIVE · {selected.role}</div>}
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(session?.memberships ?? []).map((membership) => {
              const active = selected?.workspace_id === membership.workspace_id;
              return (
                <button key={membership.workspace_id} onClick={() => void selectWorkspace(membership.workspace_id)} disabled={busyWorkspace !== null} className={`rounded-2xl border p-4 text-left transition ${active ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-slate-800 bg-slate-950 hover:border-slate-600'}`}>
                  <div className="text-sm font-black text-white">{membership.role}</div>
                  <div className="mt-2 break-all font-mono text-xs text-slate-500">{membership.workspace_id}</div>
                  <div className="mt-3 text-xs font-bold text-indigo-300">{active ? 'Active session workspace' : busyWorkspace === membership.workspace_id ? 'Activating…' : 'Use this workspace'}</div>
                </button>
              );
            })}
          </div>
          {session?.memberships?.length === 0 && <p className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">No DSG workspace membership is assigned to this account. Access fails closed.</p>}
        </section>

        <section className="mt-6">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Tools</div>
              <h2 className="mt-2 text-2xl font-black">Workroom · Spacetime · Cinema · Browser · Repair · Evidence</h2>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {toolCards.map((tool) => (
              <article key={tool.name} className="flex min-h-56 flex-col rounded-3xl border border-slate-800 bg-slate-900 p-6">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-300">{tool.badge}</div>
                <h3 className="mt-3 text-xl font-black text-white">{tool.name}</h3>
                <p className="mt-3 flex-1 text-sm leading-6 text-slate-400">{tool.description}</p>
                {tool.href && selected ? (
                  <a className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-indigo-300 hover:text-indigo-200" href={tool.href} target="_blank" rel="noreferrer">
                    Open {tool.name} <ExternalLink className="h-4 w-4" />
                  </a>
                ) : (
                  <span className="mt-5 text-sm font-bold text-slate-500">
                    {tool.href ? 'Select workspace first' : 'No verified AWS operator UI route'}
                  </span>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-6 text-sm leading-6 text-slate-400">
          <strong className="text-slate-200">Security boundary:</strong> login proves identity; workspace membership proves role. Spacetime remains execution authority. Agent Repair is proposal-only. Browser is the universal application interface. Chat/CLI/WWW remain operator surfaces, not the persistent control plane.
        </section>
      </div>
    </main>
  );
}
