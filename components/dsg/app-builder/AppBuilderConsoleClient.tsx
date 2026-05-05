'use client';

import { useState } from 'react';
import { PRDViewer } from './PRDViewer';
import { PlanObserverPanel } from './PlanObserverPanel';
import type { DsgAppBuilderPrd } from '@/lib/dsg/app-builder/types/prd';
import type { DsgAppTemplate } from '@/lib/dsg/app-builder/templates/template-registry';
import type { DsgPlanDraft, DsgPlanObserverResult } from '@/lib/dsg/app-builder/plan/types';

type PrdResponse = {
  ok: boolean;
  prd?: DsgAppBuilderPrd;
  selectedTemplate?: DsgAppTemplate;
  templateCandidates?: DsgAppTemplate[];
  boundary?: {
    claimStatus: string;
    productionReadyClaim: boolean;
    modelUsed?: boolean;
    note?: string;
  };
  error?: { code: string; message: string };
};

type PlanResponse = {
  ok: boolean;
  plan?: DsgPlanDraft;
  observer?: DsgPlanObserverResult;
  boundary?: {
    claimStatus: string;
    productionReadyClaim: boolean;
    runtimeExecutionReady: boolean;
    z3RuntimeProof?: boolean;
  };
  error?: { code: string; message: string };
};

export function AppBuilderConsoleClient({ initialPrd }: { initialPrd: DsgAppBuilderPrd }) {
  const [goal, setGoal] = useState('Build a CRM dashboard for small teams with contacts, tasks, notes, and workspace roles.');
  const [prd, setPrd] = useState(initialPrd);
  const [plan, setPlan] = useState<DsgPlanDraft | null>(null);
  const [observer, setObserver] = useState<DsgPlanObserverResult | null>(null);
  const [templateName, setTemplateName] = useState('Initial product console');
  const [status, setStatus] = useState('Ready. Generate a deterministic PRD draft from a user goal.');
  const [loadingPrd, setLoadingPrd] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);

  async function generatePrd() {
    setLoadingPrd(true);
    setStatus('Generating deterministic PRD draft…');
    try {
      const response = await fetch('/api/dsg/app-builder/prd', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ goal }),
      });
      const json = (await response.json()) as PrdResponse;
      if (!response.ok || !json.ok || !json.prd) throw new Error(json.error?.message || 'APP_BUILDER_PRD_FAILED');
      setPrd(json.prd);
      setPlan(null);
      setObserver(null);
      setTemplateName(json.selectedTemplate?.name || 'Template selected');
      setStatus(`${json.boundary?.claimStatus || 'PRD_DRAFT_ONLY'} · modelUsed=${json.boundary?.modelUsed ? 'true' : 'false'} · productionReadyClaim=false`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'APP_BUILDER_PRD_FAILED');
    } finally {
      setLoadingPrd(false);
    }
  }

  async function generatePlan() {
    setLoadingPlan(true);
    setStatus('Deriving plan draft and running observer…');
    try {
      const response = await fetch('/api/dsg/app-builder/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prd }),
      });
      const json = (await response.json()) as PlanResponse;
      if (!response.ok || !json.ok || !json.plan || !json.observer) throw new Error(json.error?.message || 'APP_BUILDER_PLAN_FAILED');
      setPlan(json.plan);
      setObserver(json.observer);
      setStatus(`${json.boundary?.claimStatus || 'PLAN_DRAFT_ONLY'} · observer=${json.observer.status} · z3RuntimeProof=${json.boundary?.z3RuntimeProof ? 'true' : 'false'} · productionReadyClaim=false`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'APP_BUILDER_PLAN_FAILED');
    } finally {
      setLoadingPlan(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-300">Prompt to PRD to Plan</p>
            <h2 className="mt-2 text-2xl font-black text-slate-100">Generate a governed PRD and plan draft</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              This uses deterministic template selection and a TypeScript observer derived from the Z3 contract. Runtime Z3 proof is still a separate evidence item.
            </p>
          </div>
          <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-200">DRAFT_ONLY</span>
        </div>
        <textarea
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          className="mt-5 min-h-32 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm leading-6 text-slate-100 outline-none focus:border-indigo-500"
          placeholder="Describe the app you want DSG to build…"
        />
        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-3 md:flex-row">
            <button onClick={() => void generatePrd()} disabled={loadingPrd} className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60">
              {loadingPrd ? 'Generating…' : 'Generate PRD draft'}
            </button>
            <button onClick={() => void generatePlan()} disabled={loadingPlan} className="rounded-2xl border border-violet-400/40 bg-violet-500/10 px-5 py-3 text-sm font-black text-violet-100 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60">
              {loadingPlan ? 'Observing…' : 'Derive Plan + Observer'}
            </button>
          </div>
          <p className="text-sm text-slate-400">Selected template: <span className="font-bold text-slate-200">{templateName}</span></p>
        </div>
        <p className="mt-4 rounded-2xl border border-slate-800 bg-slate-950 p-3 text-xs font-mono text-slate-400">{status}</p>
      </section>

      <PRDViewer prd={prd} />
      {plan && observer && <PlanObserverPanel plan={plan} observer={observer} />}
    </div>
  );
}
