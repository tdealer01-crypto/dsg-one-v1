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

const toolCards = [
  {
    name: 'Workroom',
    description: 'Primary operator workspace for governed tasks and continuous Core Spin work.',
    href: 'https://dsg-desktop-ui.greenglacier-493f3f71.westus3.azurecontainerapps.io/',
    badge: 'Operator surface',
  },
  {
    name: 'Spacetime MCP',
    description: 'Canonical MCP HTTP governance and execution authority for connected agents.',
    href: 'https://dsg-spacetime-prod.greenglacier-493f3f71.westus3.azurecontainerapps.io/mcp',
    badge: 'Governance',
  },
  {
    name: 'Cinema',
    description: 'Production proof API, plan verification, evidence and replay inspection.',
    href: 'https://dsg-cinema-production.nicetree-a005fe99.westus3.azurecontainerapps.io/docs',
    badge: 'Proof',
  },
  {
    name: 'Azure Browser',
    description: 'Universal application interface. Browser actions remain plan-bound and governed through Spacetime.',
    href: 'https://dsg-desktop-ui.greenglacier-493f3f71.westus3.azurecontainerapps.io/',
    badge: 'Universal interface',
  },
  {
    name: 'Agent Repair',
    description: 'DSG-Agent-v0 repair.synthesize is proposal-only; deterministic Repair Kernel and Spacetime remain mandatory.',
    href: 'https://www.dsg.pics/architecture-doc.html',
    badge: 'Proposal only',
  },
  {
    name: 'Status / Evidence',
    description: 'Read live runtime status and inspect bounded production evidence without exposing runtime secrets.',
    href: 'https://www.dsg.pics/governed-execution-3d.html',
    badge: 'Read only',
  },
];

export default function DsgAccessPage() {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null);
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
              Email login establishes the DSG session. Workspace role controls governed access; provider credentials remain server-side in Azure Key Vault.
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
                <div className="mt-2 text-xl font-black">{runtime?.ok ? 'READY' : 'CHECKING'}</div>
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
                {selected ? (
                  <a className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-indigo-300 hover:text-indigo-200" href={tool.href} target="_blank" rel="noreferrer">
                    Open {tool.name} <ExternalLink className="h-4 w-4" />
                  </a>
                ) : (
                  <span className="mt-5 text-sm font-bold text-slate-600">Select workspace first</span>
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
