import { getDsgActionLayerSnapshot } from '@/lib/dsg/action-layer/multi-flow-orchestrator';

const menu = [
  ['▣', 'Command Center'],
  ['♙', 'Live Reasoning'],
  ['⚖', 'Governance Vault'],
  ['⌁', 'Telemetry'],
];

const cards = [
  ['Governance Audit', 'Run comprehensive compliance check across all active DSG nodes.'],
  ['Market Analysis', 'Deploy deterministic agent for sector volatility assessment.'],
  ['Process Automation', 'Generate executable workflows for pending operational tasks.'],
];

export default function DsgActionLayerPage() {
  const snapshot = getDsgActionLayerSnapshot();

  return (
    <main className="min-h-screen bg-[#0d100f] text-[#efe8d8]">
      <header className="flex h-16 items-center justify-between border-b border-[#3a3528] px-8">
        <div className="font-serif text-3xl font-black tracking-tight text-[#f3c847]">DSG GOVERNANCE</div>
        <div className="flex items-center gap-5 text-[#d9d0bd]" aria-label="system actions">
          <span>♧</span>
          <span>⚙</span>
          <span>◎</span>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-4rem)] grid-cols-1 lg:grid-cols-[270px_1fr]">
        <aside className="border-r border-[#3a3528] bg-[#1a1d1a]">
          <div className="border-b border-[#303328] p-6">
            <div className="font-serif text-3xl font-bold text-[#f3c847]">Agent Nexus</div>
            <div className="mt-2 font-mono text-xs uppercase tracking-[0.22em] text-[#d0c5ad]">Precision Execution</div>
          </div>
          <nav className="space-y-2 p-4">
            {menu.map(([icon, label], index) => (
              <div
                key={label}
                className={`flex items-center gap-4 rounded-sm border-r-2 px-4 py-3 text-sm ${
                  index === 0 ? 'border-[#f3c847] bg-[#282b26] text-[#f3c847]' : 'border-transparent text-[#d0c5ad]'
                }`}
              >
                <span className="font-mono">{icon}</span>
                <span>{label}</span>
              </div>
            ))}
          </nav>
          <div className="mt-auto border-t border-[#303328] p-6 text-[#d0c5ad]">▤ System Status</div>
        </aside>

        <section className="px-6 py-10 lg:px-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-14 text-center">
              <div className="font-mono text-xs uppercase tracking-[0.32em] text-[#e9b949]">● Live Execution Capacity</div>
              <div className="mt-3 font-serif text-6xl font-black text-[#efe8d8]">
                {snapshot.liveExecutionCapacity.replace('.', '')}<span className="text-[#8f8264]">.00</span>
              </div>
              <div className="mx-auto mt-5 h-1 w-52 bg-gradient-to-r from-[#8d202a] via-[#ce7a24] to-[#d9c45d]" />
            </div>

            <div className="grid gap-8 xl:grid-cols-[1fr_300px]">
              <div>
                <h1 className="font-serif text-4xl font-black">Assign Enterprise Task</h1>
                <div className="mt-5 rounded-md border border-[#4a402d] bg-[#191c19] shadow-[0_0_30px_rgba(0,0,0,0.45)]">
                  <div className="min-h-36 p-6 text-[#857d70]">Enter command parameters for deterministic multi-flow execution...</div>
                  <div className="flex items-center justify-between border-t border-[#383222] p-4">
                    <div className="flex gap-6 text-[#d6cdbd]">⌕ ♫</div>
                    <button className="rounded bg-[#e2b833] px-8 py-3 font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#2a2111]">Execute ▷</button>
                  </div>
                </div>

                <div className="mt-10 grid overflow-hidden rounded-xl border border-[#282719] md:grid-cols-3">
                  {cards.map(([title, body]) => (
                    <div key={title} className="border-[#282719] bg-[#111412] p-7 md:border-r last:md:border-r-0">
                      <div className="mb-5 flex size-11 items-center justify-center rounded-full bg-[#30322c] text-[#f3c847]">◈</div>
                      <h2 className="text-xl font-semibold">{title}</h2>
                      <p className="mt-3 font-mono text-xs leading-6 tracking-[0.08em] text-[#d0c5ad]">{body}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-10 rounded-md border border-[#3a3528] bg-[#131613] p-6">
                  <div className="flex items-center justify-between border-b border-[#3a3528] pb-4">
                    <h2 className="font-serif text-3xl font-black">Live Reasoning</h2>
                    <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#f3c847]">Lane 4/5</span>
                  </div>
                  <div className="grid gap-6 pt-6 lg:grid-cols-[260px_1fr]">
                    <div className="space-y-4 font-mono text-xs leading-6 text-[#d0c5ad]">
                      <p>14:02:11 [SYS] Ingesting policy payload...</p>
                      <p>14:02:12 [AGT] Analyzing path dependencies...</p>
                      <p>14:02:14 [WARN] Constraint detected: protocol X-9.</p>
                      <p>14:02:18 [AGT] Calculating optimal vector...</p>
                    </div>
                    <div className="rounded border border-[#3a3528] bg-[#0e110f] p-8 text-center">
                      <div className="mx-auto flex size-24 items-center justify-center rounded-full border border-[#5a4725] text-4xl text-[#f3c847]">⌘</div>
                      <div className="mx-auto mt-8 max-w-sm rounded border border-[#d0a72e] p-5">
                        <div className="font-mono text-xs uppercase tracking-[0.18em] text-[#f3c847]">Synthesizing</div>
                        <div className="mt-2 text-xl">DSG Multi-Flow Node</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <aside className="space-y-5">
                <div className="rounded border border-[#3a3528] bg-[#151815] p-5">
                  <div className="font-mono text-xs uppercase tracking-[0.2em] text-[#f3c847]">Policy Guardrails</div>
                  <div className="mt-5 space-y-4">
                    {snapshot.lanes.slice(0, 4).map((lane) => (
                      <div key={lane.id} className="rounded border border-[#4a402d] p-4">
                        <div className="flex justify-between gap-3">
                          <span className="font-mono text-xs uppercase tracking-[0.15em]">{lane.label.slice(0, 14)}</span>
                          <span className="rounded border border-[#e2b833] px-2 py-1 font-mono text-[10px] text-[#e2b833]">{lane.status}</span>
                        </div>
                        <p className="mt-2 text-xs text-[#d0c5ad]">{lane.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded border border-[#3a3528] bg-[#151815] p-5">
                  <div className="font-serif text-2xl font-black">Execution Complete</div>
                  <p className="mt-3 text-sm text-[#d0c5ad]">Deterministic action layer is wired across command center, live reasoning, governance vault, telemetry, and proof timeline.</p>
                  <div className="mt-5 rounded border border-[#4a402d] p-4 font-mono text-[11px] leading-5 text-[#b9b09e]">
                    proofHash: {snapshot.proofHash.slice(0, 32)}...
                  </div>
                  <div className="mt-5 rounded bg-[#be1029] px-5 py-3 text-center font-mono text-xs uppercase tracking-[0.18em] text-white">Final Approval</div>
                </div>
              </aside>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
