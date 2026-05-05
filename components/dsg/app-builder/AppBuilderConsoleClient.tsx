'use client';

import { useState } from 'react';
import { PRDViewer } from './PRDViewer';
import { PlanObserverPanel } from './PlanObserverPanel';
import { HandoffPanel } from './HandoffPanel';
import { RuntimeGatePanel } from './RuntimeGatePanel';
import type { DsgAppBuilderPrd } from '@/lib/dsg/app-builder/types/prd';
import type { DsgAppTemplate } from '@/lib/dsg/app-builder/templates/template-registry';
import type { DsgPlanDraft, DsgPlanObserverResult } from '@/lib/dsg/app-builder/plan/types';
import type { DsgAppBuilderApprovalGate, DsgRuntimeHandoffDraft } from '@/lib/dsg/app-builder/approval/types';
import type { RuntimeExecutionGateResult } from '@/lib/dsg/app-builder/runtime/types';

type PrdResponse = {
  ok: boolean;
  prd?: DsgAppBuilderPrd;
  selectedTemplate?: DsgAppTemplate;
  templateCandidates?: DsgAppTemplate[];
  boundary?: { claimStatus: string; productionReadyClaim: boolean; modelUsed?: boolean; note?: string };
  error?: { code: string; message: string };
};

type PlanResponse = {
  ok: boolean;
  plan?: DsgPlanDraft;
  observer?: DsgPlanObserverResult;
  boundary?: { claimStatus: string; productionReadyClaim: boolean; runtimeExecutionReady: boolean; z3RuntimeProof?: boolean };
  error?: { code: string; message: string };
};

type HandoffResponse = {
  ok: boolean;
  approvalGate?: DsgAppBuilderApprovalGate;
  handoff?: DsgRuntimeHandoffDraft;
  error?: { code: string; message: string };
};

type RuntimeGateResponse = RuntimeExecutionGateResult | { ok: false; error: { code: string; message: string } };

export function AppBuilderConsoleClient({ initialPrd }: { initialPrd: DsgAppBuilderPrd }) {
  const [goal, setGoal] = useState('Build a CRM dashboard for small teams with contacts, tasks, notes, and workspace roles.');
  const [prd, setPrd] = useState(initialPrd);
  const [plan, setPlan] = useState<DsgPlanDraft | null>(null);
  const [observer, setObserver] = useState<DsgPlanObserverResult | null>(null);
  const [approvalGate, setApprovalGate] = useState<DsgAppBuilderApprovalGate | null>(null);
  const [handoff, setHandoff] = useState<DsgRuntimeHandoffDraft | null>(null);
  const [runtimeGate, setRuntimeGate] = useState<RuntimeExecutionGateResult | null>(null);
  const [templateName, setTemplateName] = useState('Initial product console');
  const [status, setStatus] = useState('Ready. Generate a deterministic PRD draft from a user goal.');
  const [loadingPrd, setLoadingPrd] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [loadingHandoff, setLoadingHandoff] = useState(false);
  const [loadingRuntimeGate, setLoadingRuntimeGate] = useState(false);

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
      setApprovalGate(null);
      setHandoff(null);
      setRuntimeGate(null);
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
      setApprovalGate(null);
      setHandoff(null);
      setRuntimeGate(null);
      setStatus(`${json.boundary?.claimStatus || 'PLAN_DRAFT_ONLY'} · observer=${json.observer.status} · z3RuntimeProof=${json.boundary?.z3RuntimeProof ? 'true' : 'false'} · productionReadyClaim=false`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'APP_BUILDER_PLAN_FAILED');
    } finally {
      setLoadingPlan(false);
    }
  }

  async function createHandoff() {
    if (!plan || !observer) {
      setStatus('APP_BUILDER_PLAN_OBSERVER_REQUIRED');
      return;
    }
    setLoadingHandoff(true);
    setStatus('Evaluating approval gate and creating runtime handoff draft…');
    try {
      const response = await fetch('/api/dsg/app-builder/handoff', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan, observer }),
      });
      const json = (await response.json()) as HandoffResponse;
      if (!response.ok || !json.ok || !json.approvalGate || !json.handoff) throw new Error(json.error?.message || 'APP_BUILDER_HANDOFF_FAILED');
      setApprovalGate(json.approvalGate);
      setHandoff(json.handoff);
      setRuntimeGate(null);
      setStatus(`${json.handoff.status} · runtimeExecutionStarted=false · productionReadyClaim=false`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'APP_BUILDER_HANDOFF_FAILED');
    } finally {
      setLoadingHandoff(false);
    }
  }

  async function startRuntimeGate() {
    if (!handoff || !plan) {
      setStatus('RUNTIME_HANDOFF_REQUIRED');
      return;
    }
    setLoadingRuntimeGate(true);
    setStatus('Evaluating fail-closed runtime execution gate…');
    try {
      const requiredSecrets = Array.from(new Set(plan.actions.flatMap((action) => action.requiredSecrets)));
      const response = await fetch('/api/dsg/app-builder/runtime/gate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          handoff,
          approval: {
            status: approvalGate?.approved ? 'APPROVED' : approvalGate?.status || 'BLOCKED',
            signatureValid: approvalGate?.approved === true,
          },
          secrets: {
            exists: false,
            expired: true,
            requiredSecrets,
            availableSecrets: [],
          },
          executorPool: {
            available: 0,
            health: 'NOT_CONFIGURED',
            mode: 'vercel-serverless-gate-only',
          },
          proofBundle: {
            requiredFields: ['audit_export', 'evidence_manifest', 'deployment_proof', 'auth_rbac_proof'],
            presentFields: [],
            hashChainValid: false,
          },
        }),
      });
      const json = (await response.json()) as RuntimeGateResponse;
      if (!response.ok || !json.ok) throw new Error('error' in json ? json.error.message : 'RUNTIME_EXECUTION_GATE_FAILED');
      setRuntimeGate(json);
      setStatus(`${json.status} · runtimeExecutionStarted=false · productionReadyClaim=false`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'RUNTIME_EXECUTION_GATE_FAILED');
    } finally {
      setLoadingRuntimeGate(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-300">Prompt to PRD to Plan to Gate</p>
            <h2 className="mt-2 text-2xl font-black text-slate-100">Generate a governed builder handoff</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Drafts PRD, derives plan, runs observer, creates handoff, then evaluates a fail-closed runtime gate. It still does not execute.
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
          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap">
            <button onClick={() => void generatePrd()} disabled={loadingPrd} className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60">
              {loadingPrd ? 'Generating…' : 'Generate PRD'}
            </button>
            <button onClick={() => void generatePlan()} disabled={loadingPlan} className="rounded-2xl border border-violet-400/40 bg-violet-500/10 px-5 py-3 text-sm font-black text-violet-100 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60">
              {loadingPlan ? 'Observing…' : 'Plan + Observer'}
            </button>
            <button onClick={() => void createHandoff()} disabled={loadingHandoff || !plan || !observer} className="rounded-2xl border border-cyan-400/40 bg-cyan-500/10 px-5 py-3 text-sm font-black text-cyan-100 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60">
              {loadingHandoff ? 'Hashing…' : 'Approval + Handoff'}
            </button>
            <button onClick={() => void startRuntimeGate()} disabled={loadingRuntimeGate || !handoff} className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-5 py-3 text-sm font-black text-rose-100 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60">
              {loadingRuntimeGate ? 'Checking…' : 'Start Runtime Gate'}
            </button>
          </div>
          <p className="text-sm text-slate-400">Selected template: <span className="font-bold text-slate-200">{templateName}</span></p>
        </div>
        <p className="mt-4 rounded-2xl border border-slate-800 bg-slate-950 p-3 text-xs font-mono text-slate-400">{status}</p>
      </section>

      <PRDViewer prd={prd} />
      {plan && observer && <PlanObserverPanel plan={plan} observer={observer} />}
      {approvalGate && handoff && <HandoffPanel approvalGate={approvalGate} handoff={handoff} />}
      {runtimeGate && <RuntimeGatePanel result={runtimeGate} />}
    </div>
  );
}
