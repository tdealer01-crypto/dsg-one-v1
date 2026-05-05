import type { DsgAppBuilderApprovalGate, DsgRuntimeHandoffDraft } from '@/lib/dsg/app-builder/approval/types';

export function HandoffPanel({ approvalGate, handoff }: { approvalGate: DsgAppBuilderApprovalGate; handoff: DsgRuntimeHandoffDraft }) {
  const tone = handoff.ready
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
    : 'border-rose-500/30 bg-rose-500/10 text-rose-200';

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950 p-6 text-slate-100">
      <div className="flex flex-col gap-3 border-b border-slate-800 pb-5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">Approval Gate + Runtime Handoff</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight">Plan hash and approval boundary</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            This creates a draft handoff envelope only. It does not execute commands, write files, deploy, or claim production readiness.
          </p>
        </div>
        <span className={`w-fit rounded-full border px-3 py-1 text-xs font-black ${tone}`}>{handoff.status}</span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Approval status</p>
          <p className="mt-1 text-xl font-black">{approvalGate.status}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">High-risk actions</p>
          <p className="mt-1 text-xl font-black">{approvalGate.summary.highRiskActions}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Blocked reasons</p>
          <p className="mt-1 text-xl font-black">{approvalGate.summary.blockedReasons}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">planHash</p>
          <p className="mt-2 break-all font-mono text-xs text-slate-300">{handoff.planHash}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">approvalHash</p>
          <p className="mt-2 break-all font-mono text-xs text-slate-300">{handoff.approvalHash}</p>
        </div>
      </div>

      {approvalGate.reasons.length > 0 && (
        <div className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
          <h3 className="font-black text-rose-200">Approval blockers</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {approvalGate.reasons.map((reason, index) => (
              <li key={`${reason.code}-${index}`}>
                <span className="font-mono text-rose-200">{reason.code}</span>{reason.actionId ? ` · ${reason.actionId}` : ''}: {reason.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <h3 className="font-black">Claim boundary</h3>
        <p className="mt-2 text-sm text-slate-300">
          {handoff.claimBoundary.claimStatus} · runtimeExecutionStarted=false · productionReadyClaim=false
        </p>
      </div>
    </section>
  );
}
