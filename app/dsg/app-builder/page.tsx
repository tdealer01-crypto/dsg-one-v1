import { AppBuilderConsoleClient } from '@/components/dsg/app-builder/AppBuilderConsoleClient';
import { DSG_APP_TEMPLATES } from '@/lib/dsg/app-builder/templates/template-registry';
import type { DsgAppBuilderPrd } from '@/lib/dsg/app-builder/types/prd';

const demoPrd: DsgAppBuilderPrd = {
  title: 'Governed Full-Stack App Builder',
  summary: 'A DSG-controlled app builder flow that turns a locked user goal into a PRD, plan, template selection, Z3 feasibility observation, approval, runtime execution, evidence, and generated app proof.',
  useCase: 'App Builder Product Console',
  userProblem: 'Users need a visible and governed way to request an app, inspect the PRD and plan, approve execution, and verify the generated output without mock claims.',
  targetUsers: ['founder', 'operator', 'developer', 'partner reviewer'],
  coreFeatures: ['Prompt to PRD preview', 'Template registry', 'Z3 plan observer status', 'OpenRouter adapter boundary', 'Generated app proof checklist'],
  nonGoals: ['No direct model-to-secret access', 'No production claim without auth/RBAC proof', 'No mock completion claim'],
  acceptanceCriteria: ['User can see PRD before approval', 'Template risks are visible', 'Z3 observer boundary is explicit', 'Production claim remains blocked until proof exists'],
  frontend: ['Next.js App Router', 'React', 'Tailwind'],
  backend: ['Next API routes', 'DSG Controlled Executor'],
  database: ['Supabase Postgres', 'api schema'],
  deployment: ['Vercel', 'GitHub PR flow'],
};

export default function DsgAppBuilderPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-3xl border border-indigo-500/30 bg-indigo-500/10 p-8 shadow-2xl shadow-indigo-950/30">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-indigo-200">DSG One Step 17</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">App Builder Product Console</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
            This page turns the builder foundation into a visible product surface: prompt-to-PRD, template registry,
            Z3 observer boundary, and production-proof checklist. It is not a Manus-level or production-ready claim yet.
          </p>
          <div className="mt-6 grid gap-3 md:grid-cols-4">
            {['Goal Lock', 'Prompt → PRD', 'Z3 Observer', 'Proof Gate'].map((item) => (
              <div key={item} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm font-bold text-slate-200">{item}</div>
            ))}
          </div>
        </section>

        <AppBuilderConsoleClient initialPrd={demoPrd} />

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Template Registry</p>
              <h2 className="mt-2 text-2xl font-black">Governed starting points</h2>
            </div>
            <p className="text-sm text-slate-400">Templates are planning metadata only until runtime proof exists.</p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {DSG_APP_TEMPLATES.map((template) => (
              <article key={template.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-indigo-300">{template.category}</p>
                    <h3 className="mt-2 text-lg font-black">{template.name}</h3>
                  </div>
                  <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-200">{template.risk}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">{template.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {template.requiredCapabilities.map((capability) => (
                    <span key={capability} className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-300">{capability}</span>
                  ))}
                </div>
                <ul className="mt-4 space-y-2 text-xs text-slate-400">
                  {template.productionNotes.map((note) => <li key={note}>• {note}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Claim Boundary</p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <h3 className="font-black text-emerald-200">Allowed now</h3>
              <p className="mt-2 text-sm text-slate-300">PRD_DRAFT_ONLY, TEMPLATE_REGISTRY_ADDED, PRD_PREVIEW_UI_ADDED</p>
            </div>
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
              <h3 className="font-black text-amber-200">Still pending</h3>
              <p className="mt-2 text-sm text-slate-300">OpenRouter smoke, runtime execution button, auth/RBAC proof, production flow proof</p>
            </div>
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
              <h3 className="font-black text-rose-200">Blocked claim</h3>
              <p className="mt-2 text-sm text-slate-300">MANUS_LEVEL_BUILDER and PRODUCTION_READY remain false until proof exists.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
