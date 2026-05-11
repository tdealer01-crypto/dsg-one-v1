'use client';

import { useEffect, useMemo, useState } from 'react';
import type { DsgDatabaseTelemetrySnapshot } from '@/lib/dsg/telemetry/database-telemetry';

const navItems = [
  { icon: '⌘', label: 'Command Center', active: false },
  { icon: 'ψ', label: 'Live Reasoning', active: false },
  { icon: '⚖', label: 'Governance Vault', active: false },
  { icon: '⌁', label: 'Telemetry', active: true },
];

type QueryResponse = {
  ok: boolean;
  answer: string;
  action?: { status: string; claim: string; proofHash: string };
};

type ExportResponse = {
  ok: boolean;
  exportedAt: string;
  source: string;
};

export function DatabaseTelemetryClient({ initialTelemetry }: { initialTelemetry: DsgDatabaseTelemetrySnapshot }) {
  const [telemetry, setTelemetry] = useState(initialTelemetry);
  const [query, setQuery] = useState('status');
  const [queryAnswer, setQueryAnswer] = useState('Connected to backend telemetry endpoint.');
  const [exportStatus, setExportStatus] = useState('Export not requested.');
  const [loading, setLoading] = useState(false);

  const endpointCount = telemetry.endpoints.length;
  const recentActions = telemetry.recentActions.slice(0, 4);
  const queryStream = useMemo(() => telemetry.queryStream, [telemetry.queryStream]);

  async function refreshTelemetry() {
    setLoading(true);
    try {
      const response = await fetch('/api/dsg/telemetry/database', { cache: 'no-store' });
      const json = (await response.json()) as DsgDatabaseTelemetrySnapshot;
      if (!response.ok || !json.ok) throw new Error('TELEMETRY_REFRESH_FAILED');
      setTelemetry(json);
      setQueryAnswer(`Refreshed ${json.claim} at ${json.generatedAt}`);
    } catch (error) {
      setQueryAnswer(error instanceof Error ? error.message : 'TELEMETRY_REFRESH_FAILED');
    } finally {
      setLoading(false);
    }
  }

  async function submitQuery() {
    setLoading(true);
    try {
      const response = await fetch('/api/dsg/telemetry/database/query', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const json = (await response.json()) as QueryResponse;
      if (!response.ok || !json.ok) throw new Error(json.answer || 'TELEMETRY_QUERY_FAILED');
      setQueryAnswer(json.answer);
    } catch (error) {
      setQueryAnswer(error instanceof Error ? error.message : 'TELEMETRY_QUERY_FAILED');
    } finally {
      setLoading(false);
    }
  }

  async function exportLogs() {
    setLoading(true);
    try {
      const response = await fetch('/api/dsg/telemetry/database/export', { cache: 'no-store' });
      const json = (await response.json()) as ExportResponse;
      if (!response.ok || !json.ok) throw new Error('TELEMETRY_EXPORT_FAILED');
      setExportStatus(`Export ready from ${json.source} at ${json.exportedAt}`);
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : 'TELEMETRY_EXPORT_FAILED');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshTelemetry();
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#121414] text-[#e2e2e2] selection:bg-[#f2ca50]/30 selection:text-[#f2ca50]">
      <header className="fixed top-0 z-50 hidden h-16 w-full items-center justify-between border-b border-[#4d4635] bg-[#121414] px-16 text-[#f2ca50] md:flex">
        <div className="font-serif text-2xl font-semibold uppercase tracking-tight md:text-[32px]">Aegis Governance</div>
        <div className="flex items-center gap-4 text-[#d0c5af]">
          <span className="rounded-full p-2 transition hover:bg-[#333535]/30 hover:text-[#f2ca50]">◉</span>
          <span className="rounded-full p-2 transition hover:bg-[#333535]/30 hover:text-[#f2ca50]">⚙</span>
          <span className="rounded-full p-2 transition hover:bg-[#333535]/30 hover:text-[#f2ca50]">◎</span>
        </div>
      </header>

      <nav className="fixed left-0 top-16 z-40 hidden h-[calc(100vh-64px)] w-64 flex-col border-r border-[#4d4635] bg-[#1e2020] md:flex">
        <div className="border-b border-[#333535] px-6 py-8">
          <h2 className="font-serif text-xl font-bold tracking-tight text-[#f2ca50]">Agent Nexus</h2>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.05em] text-[#d0c5af]/70">Precision Execution</p>
        </div>
        <ul className="flex flex-1 flex-col gap-1 overflow-y-auto py-4">
          {navItems.map((item) => (
            <li key={item.label}>
              <a className={`group flex items-center gap-4 px-6 py-3 transition-all duration-200 hover:translate-x-1 hover:bg-[#383939] ${item.active ? 'border-r-2 border-[#f2ca50] bg-[#333535]/50 font-medium text-[#f2ca50]' : 'text-[#d0c5af] hover:text-[#e2e2e2]'}`} href="#">
                <span className="font-mono text-lg transition-colors group-hover:text-[#f2ca50]">{item.icon}</span>
                <span>{item.label}</span>
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-auto border-t border-[#333535] py-4">
          <a className="flex items-center gap-4 px-6 py-3 text-[#d0c5af] transition-all duration-200 hover:translate-x-1 hover:bg-[#383939] hover:text-[#e2e2e2]" href="#">
            <span className="font-mono">▤</span>
            <span>System Status</span>
          </a>
        </div>
      </nav>

      <section className="min-h-screen bg-[#121414] pt-16 md:pl-64">
        <div className="mx-auto max-w-[1440px] space-y-6 p-5 md:p-16">
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <span className="rounded-sm border border-[#f2ca50]/30 bg-[#f2ca50]/5 px-2 py-0.5 font-mono text-xs uppercase tracking-[0.16em] text-[#f2ca50]">DSG_RUNTIME</span>
                <span className="flex items-center gap-1 rounded-sm border border-[#ff9b1a]/30 px-2 py-0.5 font-mono text-xs uppercase tracking-[0.16em] text-[#ff9b1a]"><span className="size-1.5 animate-pulse rounded-full bg-[#ff9b1a]" />Live API</span>
                <span className="rounded-sm border border-[#4d4635] px-2 py-0.5 font-mono text-xs uppercase tracking-[0.16em] text-[#d0c5af]">{endpointCount} endpoints</span>
              </div>
              <h1 className="font-serif text-2xl font-semibold tracking-tight text-[#e2e2e2] md:text-[32px] md:leading-10">Database Telemetry</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#d0c5af]">Backend-connected telemetry dashboard. Verified source: {telemetry.analyst.endpoint}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => void exportLogs()} disabled={loading} className="flex items-center gap-2 border border-[#4d4635] bg-transparent px-4 py-2 font-mono text-xs uppercase tracking-[0.05em] text-[#e2e2e2] transition-colors duration-200 hover:bg-[#383939] disabled:opacity-60"><span>↓</span>Export Logs</button>
              <button onClick={() => void refreshTelemetry()} disabled={loading} className="flex items-center gap-2 bg-[#d4af37] px-6 py-2 font-mono text-xs font-bold uppercase tracking-[0.05em] text-[#554300] shadow-[0_0_15px_rgba(212,175,55,0.15)] transition hover:brightness-110 disabled:opacity-60"><span>◌</span>{loading ? 'Syncing' : 'Refresh API'}</button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-px bg-[#4d4635] p-px md:grid-cols-12">
            <div className="col-span-1 grid grid-cols-1 gap-px md:col-span-12 md:grid-cols-3">
              {telemetry.metrics.map((card, index) => (
                <article key={card.id} className="relative flex min-h-[140px] flex-col justify-between overflow-hidden bg-[#121414] p-6">
                  {index === 0 ? <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#ffb4ab] to-[#ff9b1a] opacity-80" /> : null}
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-mono text-xs uppercase tracking-[0.05em] text-[#d0c5af]">{card.title}</h3>
                    <span className={`border px-1.5 py-0.5 font-mono text-xs uppercase tracking-[0.05em] ${card.tone === 'primary' ? 'border-[#f2ca50] text-[#f2ca50]' : 'border-[#4d4635] text-[#d0c5af]'}`}>{card.badge}</span>
                  </div>
                  <div className="mt-4">
                    <div className="flex items-baseline gap-2"><span className="font-serif text-5xl font-bold leading-[56px] tracking-[-0.02em] text-[#e2e2e2]">{card.value}</span><span className="text-base text-[#d0c5af]">{card.unit}</span></div>
                    <p className="mt-3 break-words font-mono text-xs uppercase tracking-[0.05em] text-[#d0c5af]">{card.note}</p>
                  </div>
                </article>
              ))}
            </div>

            <section className="relative col-span-1 flex min-h-[500px] flex-col bg-[#121414] p-6 md:col-span-8">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="font-serif text-2xl font-semibold text-[#e2e2e2]">Live Query Stream</h2>
                <div className="flex gap-2"><button className="bg-[#383939] px-3 py-1 font-mono text-xs uppercase tracking-[0.05em] text-[#e2e2e2]">1H</button><button className="border border-[#4d4635] bg-transparent px-3 py-1 font-mono text-xs uppercase tracking-[0.05em] text-[#d0c5af]">24H</button></div>
              </div>
              <div className="group relative flex w-full flex-1 cursor-crosshair items-center justify-center overflow-hidden border border-[#333535] bg-[#121414]">
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px]" />
                <div className="flex h-full w-full items-end gap-1 p-4 opacity-70">
                  {queryStream.map((height, index) => (
                    <div key={`${height}-${index}`} className={`relative w-full transition-colors ${index === 4 ? 'border-t border-[#ffb4ab]/50 bg-[#ffb4ab]/20' : index === 7 ? 'border-t border-[#f2ca50] bg-[#f2ca50]/40 group-hover:bg-[#f2ca50]/50' : 'bg-[#383939]'}`} style={{ height: `${height}%` }}>
                      {index === 0 || index === 3 || index === 7 ? <div className="absolute top-0 size-2 -translate-y-1 rounded-full bg-[#f2ca50] shadow-[0_0_10px_#f2ca50]" /> : null}
                    </div>
                  ))}
                </div>
                <div className="absolute right-1/4 top-1/4 w-48 border border-white/10 bg-white/[0.03] p-3 text-left opacity-0 backdrop-blur-xl transition-opacity group-hover:opacity-100">
                  <p className="mb-1 font-mono text-xs uppercase tracking-[0.05em] text-[#f2ca50]">Runtime Point</p>
                  <p className="text-[#e2e2e2]">Actions: {recentActions.length}</p>
                  <p className="mt-1 font-mono text-sm text-[#d0c5af]">{telemetry.activeFlow}</p>
                </div>
              </div>
            </section>

            <aside className="relative z-10 col-span-1 flex min-h-[500px] flex-col bg-[#121414] shadow-[-10px_0_30px_rgba(0,0,0,0.5)] md:col-span-4 md:shadow-none">
              <div className="border-b border-[#333535] bg-[#1a1c1c] p-6 [border-image:linear-gradient(to_right,transparent,#f2ca50,transparent)_1]">
                <div className="mb-1 flex items-center gap-3"><span className="text-[#f2ca50]">AI</span><h2 className="font-serif text-xl tracking-tight text-[#e2e2e2]">{telemetry.analyst.title}</h2></div>
                <p className="inline-block rounded-sm border border-[#99907c]/30 bg-[#121414] px-2 py-0.5 font-mono text-xs tracking-[0.05em] text-[#d0c5af]">{telemetry.analyst.endpoint}</p>
              </div>
              <div className="flex flex-1 flex-col space-y-6 overflow-y-auto p-6">
                <div className="flex gap-4"><div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#f2ca50]/30 bg-[#f2ca50]/10 text-sm text-[#f2ca50]">ψ</div><div className="space-y-2"><p className="text-sm leading-relaxed text-[#e2e2e2]">{telemetry.analyst.summary}</p><div className="relative space-y-2 overflow-hidden rounded-sm border border-[#383939] bg-[#121414] p-3"><div className="absolute bottom-0 left-0 top-0 w-0.5 bg-[#ff9b1a]" /><p className="font-mono text-xs uppercase tracking-[0.05em] text-[#d0c5af]">Suggested Action</p><p className="break-all border border-[#4d4635]/50 bg-[#121414] p-2 font-mono text-sm text-[#f2ca50]">{telemetry.analyst.suggestedAction}</p></div></div></div>
                <div className="rounded border border-[#333535] bg-[#1a1c1c] p-4"><p className="font-mono text-xs uppercase tracking-[0.05em] text-[#f2ca50]">Query Result</p><p className="mt-2 text-sm leading-6 text-[#d0c5af]">{queryAnswer}</p><p className="mt-2 text-xs text-[#99907c]">{exportStatus}</p></div>
                <div className="space-y-2">{recentActions.map((action) => <div key={action.actionId} className="rounded border border-[#4d4635] p-3"><div className="flex justify-between gap-2"><span className="font-mono text-xs text-[#f2ca50]">{action.flow}</span><span className="font-mono text-[10px] text-[#d0c5af]">{action.status}</span></div><p className="mt-1 text-xs text-[#d0c5af]">{action.intent}</p></div>)}</div>
              </div>
              <div className="border-t border-[#333535] bg-[#121414] p-6"><div className="group relative"><label className="sr-only" htmlFor="ai-input">Query AI</label><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void submitQuery(); }} className="w-full border-0 border-b border-[#4d4635] bg-transparent px-0 pb-2 font-mono text-xs uppercase tracking-[0.05em] text-[#e2e2e2] placeholder:text-[#d0c5af]/50 focus:border-[#f2ca50] focus:ring-0" id="ai-input" placeholder="ASK ABOUT /API/DSG/TELEMETRY..." type="text" /><button onClick={() => void submitQuery()} className="absolute bottom-2 right-0 top-0 text-[#f2ca50] transition-colors hover:text-[#d4af37]" type="button">→</button></div></div>
            </aside>
          </div>
        </div>
      </section>

      <nav className="fixed bottom-0 z-50 flex w-full justify-center bg-[#121414]/20 px-5 pb-8 text-[#f2ca50] shadow-xl backdrop-blur-md md:hidden"><button className="flex items-center gap-2 rounded-full border-2 border-transparent bg-[#f2ca50] px-6 py-3 font-mono text-xs uppercase text-[#3c2f00] shadow-[0_0_20px_rgba(242,202,80,0.3)] transition-transform duration-300 hover:scale-105"><span>ϟ</span><span>Command Bar</span></button></nav>
    </main>
  );
}
