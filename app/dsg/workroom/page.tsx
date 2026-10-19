'use client';

import Link from 'next/link';
import { PublicProductionSnapshot } from '@/components/public-production-snapshot';
import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { DsgLiveWorkroom } from '@/components/dsg-live-workroom';
import { DsgConversationalWorkspace } from '@/components/dsg-conversational-workspace';
import { AgentCommandCenter } from '@/components/agent-command-center';

type Membership = { workspace_id: string; role: 'OWNER' | 'ADMIN' | 'OPERATOR' | 'AUDITOR' | 'VIEWER' };
type SessionPayload = {
  ok: boolean;
  actor?: { id: string; email: string | null };
  memberships?: Membership[];
  selected?: Membership | null;
  error?: string;
};

const controlSurfaces = [
  {
    name: 'Desktop UI / Hub',
    badge: 'Authenticated AWS UI',
    description: 'This Workroom is the operator hub. It binds the signed-in actor to one verified DSG workspace before exposing tools.',
    href: '/dsg/access',
  },
  {
    name: 'CLI / Command Center',
    badge: 'Workspace-bound',
    description: 'Command routing and App Builder requests use the authenticated workspace session. CLI-style commands are an operator surface; Spacetime remains execution authority.',
    href: null,
  },
  {
    name: 'DSG Desktop Native',
    badge: 'First-party relay · governed',
    description: 'Pair this computer with the DSG desktop relay for filesystem, process and terminal operations. Workroom never falls back to the hosted RDC compatibility provider.',
    href: '/control/',
  },
  {
    name: 'Secret Manager',
    badge: 'AWS SSM · server-side only',
    description: 'Production runtime material is stored server-side in AWS SSM Parameter Store / SecureString. Workroom must expose names/readiness only, never secret values.',
    href: null,
  },
  {
    name: 'DSG OS / Cinema',
    badge: 'AWS · approval gated',
    description: 'Public Cinema UI and browser contract are on AWS. Browser execution still requires the existing API-key, plan and approval boundaries.',
    href: 'https://aws.dsg.pics/app',
  },
  {
    name: 'DSG Agent v0 / MCP',
    badge: 'action.plan · discovery only',
    description: 'Canonical route: route.agent.dsg-v0.plan (node.agent.dsg-v0, Kaggle T4x2). Discover it through the existing OAuth-protected https://aws.dsg.pics/mcp connector. A missing user-bound OAuth principal or unavailable Kaggle kernel blocks execution; no automatic provider fallback, no false plan/evidence claim.',
    href: '/dsg/access',
  },
  {
    name: 'Agent v0 / Kaggle',
    badge: 'Kaggle GPU · proposal only',
    description: 'Open the DSG Agent v0 Kaggle worker notebook. The notebook is an ephemeral proposal/GPU lane; live kernel health and execution evidence must be verified separately before use.',
    href: 'https://www.kaggle.com/code/taraaaa1111/dsg-agent-v0-qwen3-30b-a3b-t4x2',
  },
] as const;

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
          
          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight md:text-5xl">คุยและสั่งงานกับ DSG ONE</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                บอกเป้าหมายในแชทได้เลย ระบบแสดงผลและความคืบหน้าของแต่ละงานแยกกัน โดยไม่หยุดบทสนทนา
              </p>
            </div>
            <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold text-slate-200 hover:border-slate-500">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>
        </header>

        <details open={!selected} className="mt-5 rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-slate-300">
            บัญชีและพื้นที่ทำงาน
          </summary>
          <div className="mt-3 text-xs font-semibold text-slate-400">บัญชีที่ใช้งาน</div>
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
        </details>

        {selected ? (
          <section className="mt-6 space-y-4">
            <DsgConversationalWorkspace key={selected.workspace_id} />
            <details className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-slate-300">เครื่องมือขั้นสูงสำหรับผู้ดูแล</summary>
              <div className="mt-4"><DsgLiveWorkroom key={selected.workspace_id} /></div>
            </details>
            <details className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
              <summary className="cursor-pointer text-sm font-semibold">ข้อมูลการเชื่อมต่อและเครื่องมืออื่น</summary>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Operator control hub</div>
              <h2 className="mt-2 text-2xl font-black text-white">Desktop UI · CLI · DSG Native · Secrets · Browser · Agent v0</h2>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {controlSurfaces.map((surface) => (
                  <article key={surface.name} className="flex min-h-48 flex-col rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-indigo-300">{surface.badge}</div>
                    <h3 className="mt-2 text-lg font-black text-white">{surface.name}</h3>
                    <p className="mt-2 flex-1 text-sm leading-6 text-slate-400">{surface.description}</p>
                    {surface.href ? (
                      <a href={surface.href} target={surface.href.startsWith('http') ? '_blank' : undefined} rel={surface.href.startsWith('http') ? 'noreferrer' : undefined} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-indigo-300 hover:text-indigo-200">
                        Open {surface.name} <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : (
                      <span className="mt-4 text-xs font-bold text-slate-500">No client-side secret or direct executor binding</span>
                    )}
                  </article>
                ))}
              </div>
            </details>

            <div className="grid gap-3 md:grid-cols-3">
              <Link href="/dsg/app-builder" className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm font-bold text-indigo-300">App Builder <ExternalLink className="ml-2 inline h-4 w-4" /></Link>
              <Link href="/dsg/governance" className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm font-bold text-indigo-300">Governance <ExternalLink className="ml-2 inline h-4 w-4" /></Link>
              <a href="https://aws.dsg.pics/docs" target="_blank" rel="noreferrer" className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm font-bold text-indigo-300">Runtime Docs <ExternalLink className="ml-2 inline h-4 w-4" /></a>
            </div>

            <details className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
              <summary className="cursor-pointer text-sm font-semibold">Command Center</summary>
              <div className="mt-4"><AgentCommandCenter /></div>
            </details>
          </section>
        ) : (
          <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400">
            เลือกพื้นที่ทำงานของคุณหนึ่งครั้งเพื่อเริ่มแชท หากคุณมีพื้นที่ทำงานเดียว ระบบจะเลือกให้โดยอัตโนมัติ
          </div>
        )}

        <details className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <summary className="cursor-pointer text-sm font-semibold">หลักฐานการติดตั้งและขอบเขตที่ตรวจไว้</summary>
          <div className="mt-4"><PublicProductionSnapshot compact /></div>
        </details>

        <details className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-6 text-sm leading-6 text-slate-400">
          <summary className="min-h-11 cursor-pointer text-sm font-semibold">รายละเอียดทางเทคนิคและหลักฐาน</summary>
          <strong className="text-slate-200">Truth boundary:</strong> Workroom unifies operator surfaces, not authority. DSG Desktop Native remains enrollment- and approval-gated; Agent v0 remains an external proposal provider; Secret Manager values remain server-side; CLI/chat are request surfaces. No model response, notebook state, connector reachability or secret-name listing is execution evidence by itself. Mutating browser, desktop, deployment, purchase, secret or out-of-plan actions still require the existing governance and approval path.
        </details>
      </div>
    </main>
  );
}
