'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Bell,
  CheckCircle2,
  ChevronRight,
  Database,
  FileText,
  Gauge,
  Lock,
  MessageSquare,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal,
  Users,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardView } from '@/components/dashboard-view';
import { ExecutionsView } from '@/components/executions-view';
import { AgentsView } from '@/components/agents-view';
import { GovernanceView } from '@/components/governance-view';
import { EnterpriseProofView } from '@/components/enterprise-proof-view';
import { AgentPlaygroundView } from '@/components/agent-playground-view';

type View = 'dashboard' | 'agents' | 'executions' | 'governance' | 'proof' | 'chat';
type ProbeState = 'checking' | 'pass' | 'review' | 'blocked';

type LiveProbe = {
  id: string;
  label: string;
  endpoint: string;
  state: ProbeState;
  detail: string;
  checkedAt?: string;
};

const navItems = [
  { id: 'chat', label: 'App Builder', helper: 'Goal → PRD → Plan', icon: MessageSquare },
  { id: 'dashboard', label: 'Mission Control', helper: 'Live operating view', icon: Activity },
  { id: 'agents', label: 'Agents & Runtime', helper: 'Tool and agent layer', icon: Terminal },
  { id: 'executions', label: 'Evidence Boundary', helper: 'Proof before claims', icon: ShieldCheck },
  { id: 'governance', label: 'Governance', helper: 'Policy and approval', icon: Lock },
  { id: 'proof', label: 'Enterprise Proof', helper: 'Audit-ready view', icon: FileText },
] as const;

const principles = [
  'Public research needs source citation before use',
  'Show real endpoint state only',
  'Fail closed when proof is missing',
  'Separate deployable from production verified',
];

function badgeClass(state: ProbeState) {
  if (state === 'pass') return 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100';
  if (state === 'blocked') return 'border-red-500/50 bg-red-500/10 text-red-100';
  if (state === 'checking') return 'border-amber-300/40 bg-amber-400/10 text-amber-100';
  return 'border-slate-400/30 bg-slate-300/10 text-slate-200';
}

function StatusIcon({ state }: { state: ProbeState }) {
  if (state === 'pass') return <CheckCircle2 className="h-4 w-4" />;
  if (state === 'blocked') return <XCircle className="h-4 w-4" />;
  if (state === 'checking') return <RefreshCw className="h-4 w-4 animate-spin" />;
  return <AlertCircle className="h-4 w-4" />;
}

function formatTime(value?: string) {
  if (!value) return 'not checked';
  return new Intl.DateTimeFormat('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value));
}

async function probe(endpoint: string): Promise<{ state: ProbeState; detail: string }> {
  try {
    const response = await fetch(endpoint, { cache: 'no-store' });
    const payload = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
    if (response.ok && payload?.ok !== false) return { state: 'pass', detail: 'Live endpoint returned a usable response.' };
    if (response.status === 503) return { state: 'blocked', detail: payload?.error || 'Required server-side evidence is missing.' };
    return { state: 'review', detail: payload?.error || `Endpoint returned HTTP ${response.status}.` };
  } catch (error) {
    return { state: 'review', detail: error instanceof Error ? error.message : 'Endpoint could not be reached.' };
  }
}

function LiveMonitor() {
  const [items, setItems] = useState<LiveProbe[]>([
    { id: 'product-ready', label: 'Product-ready gate', endpoint: '/api/dsg/product-ready', state: 'checking', detail: 'Checking live readiness API.' },
    { id: 'katzilla', label: 'Katzilla agent catalog', endpoint: '/api/dsg/katzilla/agents', state: 'checking', detail: 'Checking optional free public-data connector.' },
    { id: 'public-ux-research', label: 'Public UX research evidence', endpoint: 'public citation required', state: 'review', detail: 'Use public consumer research and market UX benchmarks only after source citation is attached. No internal survey data or mock assumptions are shown.' },
  ]);

  async function refresh() {
    const checkedAt = new Date().toISOString();
    const [productReady, katzilla] = await Promise.all([
      probe('/api/dsg/product-ready'),
      probe('/api/dsg/katzilla/agents'),
    ]);

    setItems((current) => current.map((item) => {
      if (item.id === 'product-ready') return { ...item, ...productReady, checkedAt };
      if (item.id === 'katzilla') return { ...item, ...katzilla, checkedAt };
      return { ...item, checkedAt };
    }));
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const counts = useMemo(() => ({
    pass: items.filter((item) => item.state === 'pass').length,
    blocked: items.filter((item) => item.state === 'blocked').length,
    total: items.length,
  }), [items]);

  return (
    <aside className="hidden w-[380px] shrink-0 border-l border-amber-300/20 bg-gradient-to-b from-zinc-950 via-slate-950 to-zinc-950 xl:block">
      <div className="sticky top-0 h-screen overflow-y-auto p-5">
        <section className="rounded-3xl border border-amber-300/30 bg-amber-300/10 p-5 shadow-2xl shadow-amber-950/20">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-200">Live Monitor</p>
              <h2 className="mt-2 text-2xl font-black text-white">Real work, real proof</h2>
            </div>
            <button onClick={() => void refresh()} className="rounded-2xl border border-amber-300/30 bg-black/30 p-3 text-amber-100 hover:bg-amber-300/10" aria-label="Refresh live monitor">
              <RefreshCw className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3">
              <p className="text-xs text-emerald-200">PASS</p>
              <p className="mt-1 text-2xl font-black text-white">{counts.pass}</p>
            </div>
            <div className="rounded-2xl border border-slate-300/20 bg-slate-300/10 p-3">
              <p className="text-xs text-slate-300">TOTAL</p>
              <p className="mt-1 text-2xl font-black text-white">{counts.total}</p>
            </div>
            <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3">
              <p className="text-xs text-red-200">BLOCK</p>
              <p className="mt-1 text-2xl font-black text-white">{counts.blocked}</p>
            </div>
          </div>
        </section>

        <section className="mt-4 space-y-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-3xl border border-slate-700 bg-slate-900/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-slate-100">{item.label}</h3>
                  <p className="mt-1 max-w-[260px] truncate font-mono text-xs text-slate-500">{item.endpoint}</p>
                </div>
                <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-black uppercase', badgeClass(item.state))}>
                  <StatusIcon state={item.state} />
                  {item.state}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">{item.detail}</p>
              <p className="mt-3 text-xs text-slate-500">Checked: {formatTime(item.checkedAt)}</p>
            </article>
          ))}
        </section>

        <section className="mt-4 rounded-3xl border border-red-400/25 bg-red-500/10 p-5">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-red-200">Trust Boundary</p>
          <p className="mt-3 text-sm leading-6 text-slate-200">No back-office data, no guessed survey claims, and no mock performance numbers. Public research must be cited before it becomes design evidence.</p>
        </section>
      </div>
    </aside>
  );
}

function Hero({ label }: { label: string }) {
  return (
    <section className="mb-6 rounded-[2rem] border border-amber-300/25 bg-gradient-to-br from-amber-300/15 via-slate-950 to-red-950/40 p-6 shadow-2xl shadow-black/30">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-black/30 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-amber-200">
            <Sparkles className="h-3.5 w-3.5" />
            DSG App Builder Cockpit
          </div>
          <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight text-white md:text-5xl">Build with evidence, monitor live, and never claim what is not proven.</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">Gold highlights verified operating state, red exposes risk, and silver holds neutral review details. The right monitor shows live processing status and proof boundaries for user trust.</p>
        </div>
        <div className="rounded-3xl border border-slate-600 bg-slate-950/70 p-4 lg:w-72">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Current workspace</p>
          <p className="mt-2 text-2xl font-black text-amber-100">{label}</p>
          <p className="mt-2 text-sm text-slate-400">Status, evidence, and next action stay visible before execution.</p>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [currentView, setCurrentView] = useState<View>('chat');
  const current = navItems.find((item) => item.id === currentView) ?? navItems[0];

  const renderView = () => {
    switch(currentView) {
      case 'dashboard': return <DashboardView />;
      case 'agents': return <AgentsView />;
      case 'chat': return <AgentPlaygroundView />;
      case 'executions': return <ExecutionsView />;
      case 'governance': return <GovernanceView />;
      case 'proof': return <EnterpriseProofView />;
      default: return <AgentPlaygroundView />;
    }
  };

  return (
    <div className="flex h-screen w-full bg-zinc-950 text-slate-300 font-sans">
      <div className="w-72 shrink-0 border-r border-amber-300/20 bg-gradient-to-b from-zinc-950 via-slate-950 to-zinc-950 flex flex-col">
        <div className="h-20 flex items-center px-6 border-b border-amber-300/20">
          <div className="flex items-center gap-3 text-amber-200 font-black text-xl tracking-wider">
            <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-2"><Server className="w-5 h-5" /></div>
            <div><span>DSG ONE</span><p className="text-xs font-medium tracking-normal text-slate-500">Governed runtime</p></div>
          </div>
        </div>
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="text-xs font-black text-slate-500 uppercase tracking-[0.22em] mb-4 px-2">User-first flow</div>
          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button key={item.id} onClick={() => setCurrentView(item.id as View)} className={cn('w-full rounded-2xl border p-3 text-left transition-colors duration-150', isActive ? 'border-amber-300/40 bg-amber-300/10 text-amber-100 shadow-lg shadow-amber-950/20' : 'border-transparent text-slate-400 hover:border-slate-700 hover:bg-slate-900 hover:text-slate-100')}>
                  <div className="flex items-center gap-3"><Icon className={cn('w-4 h-4', isActive ? 'text-amber-200' : 'text-slate-500')} /><span className="text-sm font-black">{item.label}</span></div>
                  <p className="mt-1 pl-7 text-xs text-slate-500">{item.helper}</p>
                </button>
              );
            })}
          </nav>
          <div className="mt-6 rounded-3xl border border-slate-700 bg-slate-900/70 p-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Design evidence rules</p>
            <div className="mt-3 space-y-2">
              {principles.map((item) => <div key={item} className="flex items-start gap-2 text-xs leading-5 text-slate-300"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-200" />{item}</div>)}
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-amber-300/20">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900/70 px-3 py-3 text-sm text-slate-500">
            <div className="w-9 h-9 rounded-full border border-slate-600 bg-slate-800 flex items-center justify-center text-slate-300"><Users className="w-4 h-4" /></div>
            <div className="flex flex-col"><span className="text-slate-200 font-bold">Operator</span><span className="text-xs">Evidence-first mode</span></div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 border-b border-amber-300/20 flex items-center justify-between px-8 bg-zinc-950/70 backdrop-blur-sm z-10 sticky top-0">
          <div className="flex items-center text-sm text-slate-500"><span>Control Plane</span><ChevronRight className="w-4 h-4 mx-2 text-slate-700" /><span className="text-amber-100 font-bold capitalize">{current.label}</span></div>
          <div className="flex items-center gap-4">
            <div className="relative hidden md:block"><Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" /><input type="text" placeholder="Search disabled until real evidence index exists" disabled className="bg-slate-900 border border-slate-700 rounded-full pl-9 pr-4 py-2 text-sm text-slate-500 focus:outline-none w-80 placeholder:text-slate-600" /></div>
            <button className="relative rounded-2xl border border-slate-700 p-2 text-slate-500" aria-label="Notifications unavailable until evidence events exist"><Bell className="w-4 h-4" /></button>
            <div className="px-3 py-2 bg-red-500/10 text-red-100 text-xs font-black rounded-2xl uppercase tracking-wide border border-red-500/25 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" />No mock claims</div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <main className="flex-1 overflow-y-auto bg-[#080b12] p-6">
            <Hero label={current.label} />
            <section className="mb-6 grid gap-3 md:grid-cols-3">
              <div className="rounded-3xl border border-amber-300/25 bg-amber-300/10 p-4"><Gauge className="h-5 w-5 text-amber-200" /><p className="mt-3 text-sm font-black text-white">Readable priority</p><p className="mt-1 text-sm leading-6 text-slate-400">Large labels, clear sections, and one primary work surface at a time.</p></div>
              <div className="rounded-3xl border border-red-400/25 bg-red-500/10 p-4"><ShieldCheck className="h-5 w-5 text-red-200" /><p className="mt-3 text-sm font-black text-white">Trust boundary</p><p className="mt-1 text-sm leading-6 text-slate-400">Risk and missing proof stay visible instead of being hidden behind success styling.</p></div>
              <div className="rounded-3xl border border-slate-500/30 bg-slate-400/10 p-4"><Database className="h-5 w-5 text-slate-200" /><p className="mt-3 text-sm font-black text-white">Public research ready</p><p className="mt-1 text-sm leading-6 text-slate-400">Consumer evidence must come from cited public sources before it shapes the claim layer.</p></div>
            </section>
            <section className="rounded-[2rem] border border-slate-800 bg-slate-950/80 p-4 shadow-2xl shadow-black/30">{renderView()}</section>
          </main>
          <LiveMonitor />
        </div>
      </div>
    </div>
  );
}
