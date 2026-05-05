import type { DsgAppBuilderPrd } from '@/lib/dsg/app-builder/types/prd';

export function PRDViewer({ prd }: { prd: DsgAppBuilderPrd }) {
  const techGroups = [
    ['Frontend', prd.frontend],
    ['Backend', prd.backend],
    ['Database', prd.database],
    ['Deployment', prd.deployment],
  ] as const;

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950 p-6 text-slate-100">
      <div className="flex flex-col gap-3 border-b border-slate-800 pb-5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-300">Governed PRD Preview</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight">{prd.title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{prd.summary}</p>
        </div>
        <span className="w-fit rounded-full border border-indigo-400/40 bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-200">
          {prd.useCase}
        </span>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <h3 className="font-bold text-slate-100">User Problem</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">{prd.userProblem}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {prd.targetUsers.map((user) => (
              <span key={user} className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">{user}</span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <h3 className="font-bold text-slate-100">Acceptance Criteria</h3>
          <ol className="mt-3 space-y-2 text-sm text-slate-300">
            {prd.acceptanceCriteria.map((item, index) => (
              <li key={item} className="flex gap-2"><span className="font-mono text-indigo-300">{index + 1}.</span><span>{item}</span></li>
            ))}
          </ol>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <h3 className="font-bold text-emerald-200">Core Features</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {prd.coreFeatures.map((feature) => <li key={feature}>✓ {feature}</li>)}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <h3 className="font-bold text-amber-200">Out of Scope</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {prd.nonGoals.map((goal) => <li key={goal}>— {goal}</li>)}
          </ul>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <h3 className="font-bold text-slate-100">Recommended Stack</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          {techGroups.map(([label, values]) => (
            <div key={label}>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {values.map((tech) => <span key={tech} className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-200">{tech}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
