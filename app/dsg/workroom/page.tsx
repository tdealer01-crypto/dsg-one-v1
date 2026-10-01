'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react';
import { LiveAgentChat } from '@/components/live-agent-chat';

type Membership = { workspace_id: string; role: 'OWNER' | 'ADMIN' | 'OPERATOR' | 'AUDITOR' | 'VIEWER' };
type SessionPayload = {
  ok: boolean;
  actor?: { id: string; email: string | null };
  memberships?: Membership[];
  selected?: Membership | null;
  error?: string;
};

export default function DsgWorkroomPage() {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [busyWorkspace, setBusyWorkspace] = useState<string | null>(null);
  const [message, setMessage] = useState('Loading authenticated workspace…');

  const load = useCallback(async () => {
    const response = await fetch('/api/dsg/access/session', { cache: 'no-store', credentials: 'include' });
    if (response.status === 401) {
      window.location.assign('/login?next=/dsg/workroom');
      return;
    }
    const payload = await response.json() as SessionPayload;
    setSession(payload);
    setMessage(payload.selected ? 'Authenticated workspace is active.' : 'Select a governed workspace before using Workroom.');
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
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!session || session.selected || session.memberships?.length !== 1 || busyWorkspace) return undefined;
    const timer = window.setTimeout(() => void selectWorkspace(session.memberships![0].workspace_id), 0);
    return () => window.clearTimeout(timer);
  }, [session, busyWorkspace, selectWorkspace]);

  const selected = session?.selected ?? null;

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-slate-100 md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-[2rem] border border-slate-800 bg-slate-900/80 p-6 md:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">
            <ShieldCheck className="h-3.5 w-3.5" /> AWS Native Workroom
          </div>
          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight md:text-5xl">Governed operator workspace.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                This Workroom uses the verified DSG website session and selected workspace. Agent chat can inspect, plan and propose work; Spacetime remains execution authority and approval/evidence gates still apply.
              </p>
            </div>
            <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold text-slate-200 hover:border-slate-500">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>
        </header>

        <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Workspace authority</div>
          <div className="mt-2 text-lg font-black text-white">{session?.actor?.email ?? 'Loading…'}</div>
          <p className="mt-2 text-sm text-slate-400">{message}</p>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(session?.memberships ?? []).map((membership) => {
              const active = selected?.workspace_id === membership.workspace_id;
              return (
                <button key={membership.workspace_id} onClick={() => void selectWorkspace(membership.workspace_id)} disabled={busyWorkspace !== null} className={`rounded-2xl border p-4 text-left transition ${active ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-slate-800 bg-slate-950 hover:border-slate-600'}`}>
                  <div className="text-sm font-black text-white">{membership.role}</div>
                  <div className="mt-2 break-all font-mono text-xs text-slate-500">{membership.workspace_id}</div>
                  <div className="mt-3 text-xs font-bold text-indigo-300">{active ? 'Active workspace' : busyWorkspace === membership.workspace_id ? 'Activating…' : 'Use this workspace'}</div>
                </button>
              );
            })}
          </div>
          {session?.memberships?.length === 0 && <p className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">No DSG workspace membership is assigned. Workroom fails closed.</p>}
        </section>

        {selected ? (
          <section className="mt-6 space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <a href="/dsg/app-builder" className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm font-bold text-indigo-300">App Builder <ExternalLink className="ml-2 inline h-4 w-4" /></a>
              <a href="/dsg/governance" className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm font-bold text-indigo-300">Governance <ExternalLink className="ml-2 inline h-4 w-4" /></a>
              <a href="https://aws.dsg.pics/app" target="_blank" rel="noreferrer" className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm font-bold text-indigo-300">Cinema / Browser <ExternalLink className="ml-2 inline h-4 w-4" /></a>
            </div>
            <LiveAgentChat />
          </section>
        ) : (
          <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400">
            Select a verified workspace before chat or operator actions become available.
          </div>
        )}

        <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-6 text-sm leading-6 text-slate-400">
          <strong className="text-slate-200">Truth boundary:</strong> Workroom is an operator surface, not execution authority. No model response is evidence by itself. Mutating browser, deployment, purchase, secret, or out-of-plan actions still require the existing governance and approval path.
        </section>
      </div>
    </main>
  );
}
