import type { RuntimeExecutionGateResult } from '@/lib/dsg/app-builder/runtime/types';

export function RuntimeGatePanel({ result }: { result: RuntimeExecutionGateResult }) {
  const tone = result.status === 'READY'
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
    : 'border-rose-500/30 bg-rose-500/10 text-rose-200';

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950 p-6 text-slate-100">
      <div className="flex flex-col gap-3 border-b border-slate-800 pb-5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-300">Runtime Execution Gate</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight">Fail-closed start runtime check</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            This gate evaluates approval, secret binding, executor readiness, proof completeness, and handoff integrity. It never starts execution in this step.
          </p>
        </div>
        <span className={`w-fit rounded-full border px-3 py-1 text-xs font-black ${tone}`}>{result.status}</span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Gate hash</p>
          <p className="mt-2 break-all font-mono text-xs text-slate-300">{result.gateHash}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Audit record</p>
          <p className="mt-2 break-all font-mono text-xs text-slate-300">{result.audit.immutableRecordHash}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Executor mode</p>
          <p className="mt-2 text-sm font-black text-amber-200">{result.boundary.executorMode}</p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <h3 className="font-black">Invariants evaluated</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {result.audit.invariantsEvaluated.map((invariant) => (
            <span key={invariant} className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-300">{invariant}</span>
          ))}
        </div>
      </div>

      {result.failures.length > 0 && (
        <div className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
          <h3 className="font-black text-rose-200">Blocked reasons</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {result.failures.map((failure, index) => (
              <li key={`${failure.invariant}-${index}`}>
                <span className="font-mono text-rose-200">{failure.invariant}</span>: expected {failure.expected}; actual {failure.actual}; severity={failure.severity}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <h3 className="font-black">Claim boundary</h3>
        <p className="mt-2 text-sm text-slate-300">
          {result.boundary.claimStatus} · runtimeExecutionStarted=false · productionReadyClaim=false
        </p>
      </div>
    </section>
  );
}
