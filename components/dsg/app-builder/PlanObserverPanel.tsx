import type { DsgPlanDraft, DsgPlanObserverResult } from '@/lib/dsg/app-builder/plan/types';

export function PlanObserverPanel({ plan, observer }: { plan: DsgPlanDraft; observer: DsgPlanObserverResult }) {
  const statusTone = observer.status === 'PASS'
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
    : observer.status === 'BLOCK'
      ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
      : 'border-amber-500/30 bg-amber-500/10 text-amber-200';

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950 p-6 text-slate-100">
      <div className="flex flex-col gap-3 border-b border-slate-800 pb-5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-300">Plan Draft Observer</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight">PRD → governed plan draft</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            This observer checks plan feasibility before approval. It does not execute, approve, deploy, or replace Risk Control/RBAC.
          </p>
        </div>
        <span className={`w-fit rounded-full border px-3 py-1 text-xs font-black ${statusTone}`}>{observer.status}</span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Actions</p>
          <p className="mt-1 text-2xl font-black">{observer.summary.actions}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Waves</p>
          <p className="mt-1 text-2xl font-black">{observer.summary.waves.join(', ') || '—'}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Blockers</p>
          <p className="mt-1 text-2xl font-black">{observer.summary.blockedReasons}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Z3 runtime proof</p>
          <p className="mt-1 text-sm font-black text-amber-200">{observer.z3RuntimeProof ? 'attached' : 'not attached'}</p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <h3 className="font-black">Plan actions</h3>
        <div className="mt-4 space-y-3">
          {plan.actions.map((action) => (
            <div key={action.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-black text-slate-100">{action.label}</p>
                  <p className="mt-1 text-xs font-mono text-slate-500">{action.id} · wave {action.wave} · {action.type}</p>
                </div>
                <div className="flex gap-2">
                  <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-300">{action.risk}</span>
                  <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-300">{action.approved ? 'approved' : 'not approved'}</span>
                </div>
              </div>
              {action.writes.length > 0 && <p className="mt-3 text-xs text-slate-400">writes: {action.writes.join(', ')}</p>}
              {action.requiredSecrets.length > 0 && <p className="mt-2 text-xs text-amber-300">requires secrets: {action.requiredSecrets.join(', ')}</p>}
            </div>
          ))}
        </div>
      </div>

      {observer.reasons.length > 0 && (
        <div className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
          <h3 className="font-black text-rose-200">Observer reasons</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {observer.reasons.map((reason, index) => (
              <li key={`${reason.code}-${index}`}>
                <span className="font-mono text-rose-200">{reason.code}</span>{reason.actionId ? ` · ${reason.actionId}` : ''}: {reason.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
