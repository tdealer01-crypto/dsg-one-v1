import { getDsgActionLayerSnapshot } from '@/lib/dsg/action-layer/multi-flow-orchestrator';

const navItems = [
  { icon: '⌘', label: 'Command Center', active: true },
  { icon: 'ψ', label: 'Live Reasoning', active: false },
  { icon: '⚖', label: 'Governance Vault', active: false },
  { icon: '⌁', label: 'Telemetry', active: false },
];

const environmentTabs = [
  { icon: '⎇', label: '/dsg/flow-studio/orchestrator', active: true },
  { icon: '⇆', label: '/dsg/flow-studio/config', active: false },
  { icon: 'API', label: '/dsg/flow-studio/mcp', active: false },
  { icon: '◇', label: '/dsg/flow-studio/mutate', active: false },
];

export default function DsgActionLayerPage() {
  const snapshot = getDsgActionLayerSnapshot();
  const guardrails = snapshot.lanes.slice(0, 4);
  const recentActions = snapshot.recentActions.slice(0, 3);

  return (
    <main className="h-screen overflow-hidden bg-[#121414] text-[#e2e2e2]">
      <header className="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b border-[#4d4635] bg-[#121414] px-5 md:px-16">
        <div className="flex items-center gap-4">
          <span className="font-serif text-2xl font-black uppercase tracking-tight text-[#f2ca50] md:text-[32px]">
            Aegis Governance
          </span>
        </div>
        <div className="flex items-center gap-6 text-[#f2ca50]" aria-label="system actions">
          <span aria-label="notifications" className="transition hover:scale-105">◉</span>
          <span aria-label="settings" className="transition hover:scale-105">⚙</span>
          <span aria-label="account" className="transition hover:scale-105">◎</span>
        </div>
      </header>

      <nav className="fixed left-0 top-16 z-40 hidden h-[calc(100vh-64px)] w-64 flex-col border-r border-[#4d4635] bg-[#1e2020] md:flex">
        <div className="border-b border-[#4d4635] p-6">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full border-2 border-[#f2ca50] bg-[#121414] font-mono text-xs font-bold text-[#f2ca50]">
              DSG
            </div>
            <div>
              <div className="font-mono text-xs uppercase tracking-[0.22em] text-[#f2ca50]">Agent Nexus</div>
              <div className="text-xs text-[#d0c5af]">Precision Execution</div>
            </div>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 py-4">
          {navItems.map((item) => (
            <a
              key={item.label}
              href="#"
              className={`flex items-center gap-3 px-4 py-3 transition-all duration-200 hover:translate-x-1 hover:bg-[#383939] ${
                item.active
                  ? 'border-r-2 border-[#f2ca50] bg-[#333535]/50 text-[#f2ca50]'
                  : 'text-[#d0c5af] hover:text-[#e2e2e2]'
              }`}
            >
              <span className="font-mono text-lg">{item.icon}</span>
              <span className="text-base">{item.label}</span>
            </a>
          ))}
        </div>
        <div className="mt-auto border-t border-[#4d4635] p-4">
          <a className="flex items-center gap-3 px-4 py-3 text-[#d0c5af] transition-all duration-200 hover:translate-x-1 hover:bg-[#383939] hover:text-[#e2e2e2]" href="#">
            <span className="font-mono">▤</span>
            <span>System Status</span>
          </a>
        </div>
      </nav>

      <section className="relative ml-0 mt-16 flex h-[calc(100vh-64px)] flex-col md:ml-64">
        <div className="z-20 flex w-full items-center justify-between border-b border-[#4d4635] bg-[#282a2a] px-5 py-2 shadow-[0_4px_24px_rgba(0,0,0,0.5)] md:px-6">
          <div className="hidden items-center gap-8 font-mono text-xs uppercase tracking-[0.16em] text-[#d0c5af] xl:flex">
            {environmentTabs.map((tab) => (
              <div key={tab.label} className={`flex items-center gap-2 pb-1 ${tab.active ? 'border-b border-[#f2ca50] text-[#f2ca50]' : 'transition hover:text-[#e2e2e2]'}`}>
                <span className="text-[11px]">{tab.icon}</span>
                <span>{tab.label}</span>
              </div>
            ))}
          </div>
          <div className="flex w-full items-center justify-between gap-4 xl:w-auto">
            <span className="rounded border border-[#f2ca50] px-2 py-1 font-mono text-xs uppercase text-[#f2ca50]">
              Status: {snapshot.complete ? 'Active Run' : 'Review'}
            </span>
            <button className="flex items-center gap-2 rounded-sm bg-[#f2ca50] px-4 py-2 font-mono text-xs uppercase text-[#3c2f00] transition-colors hover:bg-[#d4af37]">
              <span>▶</span>
              Deploy Execution
            </button>
          </div>
        </div>

        <div className="relative flex-1 overflow-hidden bg-[#121414] bg-[radial-gradient(circle_at_1px_1px,#333535_1px,transparent_0)] bg-[size:24px_24px]">
          <div className="absolute inset-0 z-10 flex items-center gap-16 overflow-x-auto p-8 lg:p-12">
            <div className="relative w-72 shrink-0 rounded border border-[#4d4635] bg-[#121414] shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#4d4635] bg-[#333535] px-4 py-3">
                <span className="font-mono text-xs uppercase text-[#e2e2e2]">Data Ingestion</span>
                <span className="text-[#d0c5af]">↳</span>
              </div>
              <div className="flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#d0c5af]">Source</span>
                  <span className="font-mono text-[#f2ca50]">Verified_Input</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#d0c5af]">Payload</span>
                  <span className="font-mono text-[#e2e2e2]">Runtime Snapshot</span>
                </div>
              </div>
              <div className="absolute -right-16 top-1/2 h-px w-16 bg-[#4d4635]" />
              <div className="absolute -right-16 top-1/2 size-2 -translate-y-1/2 rounded-full bg-[#4d4635]" />
            </div>

            <div className="relative z-20 w-80 shrink-0 rounded border border-[#f2ca50] bg-[#121414] shadow-[0_0_20px_rgba(212,175,55,0.12)]">
              <div className="absolute -right-3 -top-3">
                <span className="relative flex size-4">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#f2ca50] opacity-75" />
                  <span className="relative inline-flex size-4 rounded-full border-2 border-[#121414] bg-[#f2ca50]" />
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-[#4d4635] bg-[#333535] px-4 py-3">
                <span className="font-mono text-xs uppercase text-[#f2ca50]">Compliance Gate Alpha</span>
                <span className="text-[#f2ca50]">⚖</span>
              </div>
              <div className="flex flex-col gap-4 p-4">
                <div className="rounded-sm border border-[#4d4635] bg-[#121414] p-3">
                  <code className="font-mono text-[10px] leading-tight text-[#d0c5af]">
                    verify(input);<br />
                    if pending return REVIEW;<br />
                    if blocked return REJECT_PATH;<br />
                    return APPROVE_PATH;
                  </code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs uppercase text-[#d0c5af]">Eval Result</span>
                  <span className="rounded-sm border border-[#f2ca50] px-2 py-1 font-mono text-xs text-[#f2ca50]">
                    {snapshot.complete ? 'Authorized' : 'Review'}
                  </span>
                </div>
              </div>
              <div className="absolute -right-16 top-1/2 h-px w-16 bg-[#f2ca50]" />
              <div className="absolute -right-16 top-1/2 size-2 -translate-y-1/2 rounded-full bg-[#f2ca50] shadow-[0_0_8px_#d4af37]" />
            </div>

            <div className="relative w-72 shrink-0 rounded border border-[#4d4635] bg-[#121414] shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#4d4635] bg-[#333535] px-4 py-3">
                <span className="font-mono text-xs uppercase text-[#e2e2e2]">Target Execution</span>
                <span className="text-[#d0c5af]">ϟ</span>
              </div>
              <div className="flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#d0c5af]">Endpoint</span>
                  <span className="ml-4 truncate font-mono text-[#e2e2e2]">/api/dsg/action-layer/status</span>
                </div>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[#282a2a]">
                  <div className="h-full w-full bg-[#f2ca50]" />
                </div>
              </div>
            </div>
          </div>

          <div className="absolute bottom-6 right-6 z-30 flex w-[min(420px,calc(100vw-48px))] flex-col rounded-lg border border-white/10 border-t-2 border-t-[#f2ca50] bg-white/[0.05] shadow-2xl backdrop-blur-xl md:bottom-12 md:right-12">
            <div className="flex items-center justify-between border-b border-white/10 bg-[#333535]/50 p-4">
              <div className="flex items-center gap-2">
                <span className="animate-pulse text-[#f2ca50]">●</span>
                <span className="font-mono text-xs uppercase tracking-[0.22em] text-[#f2ca50]">AI Reasoning Active</span>
              </div>
              <span className="rounded-full border border-[#4d4635] px-2 py-0.5 font-mono text-[10px] text-[#d0c5af]">DSG-v1</span>
            </div>
            <div className="flex flex-col gap-4 p-5">
              <div>
                <h4 className="mb-1 text-sm font-semibold text-[#e2e2e2]">Deterministic Gate Analysis</h4>
                <p className="text-xs leading-relaxed text-[#d0c5af]">
                  Current snapshot returns {snapshot.claim}. The page presents verified lanes and proof stream without changing the production runtime.
                </p>
              </div>
              <div className="relative rounded-sm border border-[#333] bg-[#0a0a0a] p-3 font-mono text-[11px] leading-relaxed">
                <div className="absolute right-0 top-0 border-b border-l border-[#333] bg-[#222] px-2 py-1 text-[9px] text-[#888]">proof</div>
                <span className="text-[#888]">// Runtime evidence</span><br />
                <span className="text-[#f2ca50]">claim: {snapshot.claim}</span><br />
                <span className="text-[#4ade80]">lanes: {snapshot.lanes.length}</span><br />
                <span className="text-[#888]">proof: {snapshot.proofHash.slice(0, 18)}...</span>
              </div>
              <div className="flex gap-2 pt-2">
                <button className="flex-1 border border-[#4d4635] bg-[#1e2020] py-2 font-mono text-xs uppercase tracking-wide text-[#e2e2e2] transition-colors hover:border-[#f2ca50] hover:text-[#f2ca50]">
                  Flag for Review
                </button>
                <button className="flex flex-1 items-center justify-center gap-1 border border-[#f2ca50] bg-[#f2ca50] py-2 font-mono text-xs uppercase tracking-wide text-[#3c2f00] transition-colors hover:bg-[#d4af37]">
                  <span>✓</span>
                  Approve Path
                </button>
              </div>
            </div>
          </div>

          <div className="absolute left-5 top-5 z-20 hidden w-72 rounded-lg border border-[#4d4635] bg-[#1a1c1c]/90 p-4 backdrop-blur md:block">
            <div className="font-mono text-xs uppercase tracking-[0.22em] text-[#f2ca50]">Guardrails</div>
            <div className="mt-4 space-y-3">
              {guardrails.map((lane) => (
                <div key={lane.id} className="rounded border border-[#4d4635] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-[#e2e2e2]">{lane.label}</span>
                    <span className="font-mono text-[10px] text-[#f2ca50]">{lane.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-[#d0c5af]">{lane.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="absolute left-5 bottom-5 z-20 hidden w-80 rounded-lg border border-[#4d4635] bg-[#1a1c1c]/90 p-4 backdrop-blur lg:block">
            <div className="font-mono text-xs uppercase tracking-[0.22em] text-[#f2ca50]">Recent Proof Stream</div>
            <div className="mt-4 space-y-3 font-mono text-xs leading-5 text-[#d0c5af]">
              {recentActions.map((action) => (
                <p key={action.actionId}>
                  <span className="text-[#f2ca50]">[{action.flow}]</span> {action.intent} → {action.status}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <nav className="fixed bottom-0 z-50 flex w-full justify-center bg-[#121414]/20 px-5 pb-8 backdrop-blur-md md:hidden">
        <button className="flex items-center gap-2 rounded-full bg-[#f2ca50] px-6 py-3 font-mono text-xs uppercase text-[#3c2f00] shadow-xl transition-transform duration-300 hover:scale-105">
          <span>ϟ</span>
          <span>Command Bar</span>
        </button>
      </nav>
    </main>
  );
}
