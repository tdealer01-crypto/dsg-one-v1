'use client';

import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, FileText, Loader2, PlayCircle, Send, ShieldCheck, Wrench } from 'lucide-react';

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: { code?: string; message?: string } };

type BuilderJob = {
  id: string;
  status: string;
  claimStatus: string;
  goal?: { normalizedGoal: string; goalHash: string; successCriteria: string[]; constraints: string[] };
  prd?: { summary: string };
  proposedPlan?: { steps: Array<{ id: string; title: string; phase: string; riskLevel: string; requiresApproval: boolean; expectedEvidence: string[] }> };
  gateResult?: { status: string; riskLevel: string; approvalRequired: boolean };
  planHash?: string;
  approvalHash?: string;
};

type Handoff = { planHash: string; approvalHash: string; runtimeStatus: string };
type RuntimeEnvironment = { environmentType: string; repository: string; branchName: string; manifestPath: string; evidence: { note: string } };
type Execution = { branchName: string; pullRequestUrl: string; pullRequestNumber: number; repository: string; generatedFiles: Array<{ path: string; evidenceKind: string }>; evidence: { note: string } };
type ToolCall = {
  toolName: string;
  status: string;
  riskLevel: string;
  claimStatus: string;
  environment: RuntimeEnvironment;
  actionLayer: { runtimeAdapter: string; actionLayer: string; permissionVerdict: string; exposedTools: string[]; auditRequired: boolean };
  output: Execution;
  auditEvent: { eventType: string; outcome: string; evidenceRefs: string[]; createdAt: string };
  notification: { title: string; message: string; nextAction: string };
  evidence: { approvalChecked: boolean; planHashChecked: boolean; allowedToolChecked: boolean; environmentReady: boolean; actionLayerReady: boolean; auditWritten: boolean; note: string };
};

const APP_BUILDER_TOOL_NAME = 'dsg.app_builder.launch_agent_runtime';

function shortHash(value?: string) {
  return value ? `${value.slice(0, 10)}…${value.slice(-6)}` : 'missing';
}

function readResult<T>(json: ApiResult<T>): T {
  if (!json.ok) throw new Error(json.error?.message || json.error?.code || 'REQUEST_FAILED');
  return json.data;
}

export function AppBuilderAgentRuntimeView() {
  const [workspaceId, setWorkspaceId] = useState('demo-workspace');
  const [actorId, setActorId] = useState('operator');
  const [goal, setGoal] = useState('Build a governed full-stack todo app with frontend, backend API, database table, runtime environment, action-layer audit, notification, and GitHub PR evidence.');
  const [criteria, setCriteria] = useState('Runtime environment manifest exists\nAction-layer contract is returned\nAudit event is written\nGenerated code is written to GitHub\nPull request URL is returned\nNo production claim without CI/deploy proof');
  const [constraints, setConstraints] = useState('No action before approval\nNo write outside approved paths\nNo bypass of gate, audit, or evidence\nNo deployable or production claim without proof');
  const [job, setJob] = useState<BuilderJob | null>(null);
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [toolCall, setToolCall] = useState<ToolCall | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function api<T>(path: string, init?: RequestInit) {
    const response = await fetch(path, {
      ...init,
      headers: {
        'content-type': 'application/json',
        'x-dsg-workspace-id': workspaceId.trim(),
        'x-dsg-actor-id': actorId.trim(),
        ...(init?.headers || {}),
      },
    });
    const json = (await response.json().catch(() => ({ ok: false, error: { message: 'INVALID_JSON_RESPONSE' } }))) as ApiResult<T>;
    if (!response.ok && json.ok) throw new Error(`HTTP_${response.status}`);
    return readResult(json);
  }

  async function runStep(name: string, fn: () => Promise<void>) {
    setBusy(name);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'APP_BUILDER_REQUEST_FAILED');
    } finally {
      setBusy(null);
    }
  }

  const createJob = () => runStep('goal', async () => {
    setHandoff(null);
    setToolCall(null);
    const data = await api<BuilderJob>('/api/dsg/app-builder/jobs', {
      method: 'POST',
      body: JSON.stringify({
        goal,
        successCriteria: criteria.split('\n').map((x) => x.trim()).filter(Boolean),
        constraints: constraints.split('\n').map((x) => x.trim()).filter(Boolean),
        targetStack: { frontend: 'nextjs', backend: 'next-api', database: 'supabase-postgres', auth: 'none', deploy: 'vercel' },
      }),
    });
    setJob(data);
  });

  const createPlan = () => runStep('plan', async () => {
    if (!job) throw new Error('APP_BUILDER_JOB_REQUIRED');
    setHandoff(null);
    setToolCall(null);
    setJob(await api<BuilderJob>(`/api/dsg/app-builder/jobs/${job.id}/plan`, { method: 'POST' }));
  });

  const approvePlan = () => runStep('approval', async () => {
    if (!job?.proposedPlan) throw new Error('APP_BUILDER_PLAN_REQUIRED');
    setHandoff(null);
    setToolCall(null);
    setJob(await api<BuilderJob>(`/api/dsg/app-builder/jobs/${job.id}/approval`, {
      method: 'POST',
      body: JSON.stringify({ decision: 'APPROVE', reason: 'Approved visible App Builder plan before runtime action.' }),
    }));
  });

  const createHandoff = () => runStep('handoff', async () => {
    if (!job?.approvalHash) throw new Error('APP_BUILDER_APPROVAL_REQUIRED');
    setHandoff(await api<Handoff>(`/api/dsg/app-builder/jobs/${job.id}/runtime-handoff`, { method: 'POST' }));
  });

  const launchRuntimeTool = () => runStep('tool-call', async () => {
    if (!job?.approvalHash) throw new Error('APP_BUILDER_APPROVAL_REQUIRED');
    const data = await api<{ job: BuilderJob; toolCall: ToolCall }>(`/api/dsg/app-builder/jobs/${job.id}/tool-call`, {
      method: 'POST',
      body: JSON.stringify({ toolName: APP_BUILDER_TOOL_NAME, arguments: { mode: 'agent_runtime_fullstack_pr' } }),
    });
    setJob(data.job);
    setToolCall(data.toolCall);
  });

  const gateBlocked = job?.gateResult?.status === 'BLOCK';
  const execution = toolCall?.output;
  const cards = [
    ['Goal lock', job?.goal ? `goalHash ${shortHash(job.goal.goalHash)}` : 'waiting'],
    ['Plan gate', job?.gateResult ? `${job.gateResult.status} / ${job.gateResult.riskLevel}` : 'missing'],
    ['Approval', job?.approvalHash ? `approvalHash ${shortHash(job.approvalHash)}` : 'missing'],
    ['Runtime handoff', handoff ? shortHash(handoff.planHash) : 'missing'],
    ['App Builder tool', toolCall ? `${toolCall.toolName} · ${toolCall.status}` : 'missing'],
    ['Environment', toolCall ? `${toolCall.environment.environmentType} · ${toolCall.environment.branchName}` : 'missing'],
    ['Action layer', toolCall ? `${toolCall.actionLayer.actionLayer} · ${toolCall.actionLayer.permissionVerdict}` : 'missing'],
    ['Audit', toolCall ? `${toolCall.auditEvent.outcome} · ${toolCall.auditEvent.evidenceRefs.length} refs` : 'missing'],
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5 text-sm leading-7 text-emerald-100">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-200"><ShieldCheck className="h-4 w-4" /> App Builder Tool · Agent Runtime Orchestration</div>
        <p className="mt-3">Plan must pass gate and approval before this screen launches the App Builder orchestration tool. The tool prepares environment, exposes action-layer tools, writes audit evidence, creates PR output, and blocks production claims until CI/deploy proof exists.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h1 className="text-2xl font-bold text-slate-100">Build full-stack app through App Builder tool</h1>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-xs text-slate-400">Workspace ID<input value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200" /></label>
            <label className="space-y-1 text-xs text-slate-400">Actor ID<input value={actorId} onChange={(e) => setActorId(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200" /></label>
          </div>
          <label className="space-y-2 text-xs text-slate-400">Goal<textarea rows={4} value={goal} onChange={(e) => setGoal(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200" /></label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-2 text-xs text-slate-400">Success criteria<textarea rows={4} value={criteria} onChange={(e) => setCriteria(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200" /></label>
            <label className="space-y-2 text-xs text-slate-400">Constraints<textarea rows={4} value={constraints} onChange={(e) => setConstraints(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200" /></label>
          </div>
          {error && <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-200"><AlertCircle className="mr-2 inline h-4 w-4" />{error}</div>}
          <div className="flex flex-wrap gap-3">
            <button onClick={createJob} disabled={!!busy || !goal.trim()} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:bg-slate-800 disabled:text-slate-500">{busy === 'goal' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Lock goal</button>
            <button onClick={createPlan} disabled={!!busy || !job} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold text-slate-200 disabled:text-slate-600">{busy === 'plan' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} PRD + plan</button>
            <button onClick={approvePlan} disabled={!!busy || !job?.proposedPlan || gateBlocked} className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-200 disabled:border-slate-800 disabled:text-slate-600">{busy === 'approval' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Approve plan</button>
            <button onClick={createHandoff} disabled={!!busy || !job?.approvalHash} className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-bold text-amber-100 disabled:border-slate-800 disabled:text-slate-600">{busy === 'handoff' ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />} Runtime handoff</button>
            <button onClick={launchRuntimeTool} disabled={!!busy || !job?.approvalHash || job.status !== 'READY_FOR_RUNTIME'} className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/50 bg-indigo-500/10 px-4 py-2 text-sm font-bold text-indigo-100 disabled:border-slate-800 disabled:text-slate-600">{busy === 'tool-call' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />} Launch App Builder tool</button>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold text-slate-100">Execution state</h2><span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">{job?.status ?? 'NO_JOB'} · {job?.claimStatus ?? 'NO_CLAIM'}</span></div>
          <div className="grid gap-3 md:grid-cols-2">{cards.map(([label, detail]) => <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"><p className="font-semibold text-slate-200">{label}</p><p className="mt-1 text-xs font-mono text-slate-500">{detail}</p></div>)}</div>
          {job?.proposedPlan && <div className="space-y-3">{job.proposedPlan.steps.map((step) => <div key={step.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"><p className="text-xs font-mono text-slate-500">{step.id} · {step.phase} · {step.riskLevel}{step.requiresApproval ? ' · approval required' : ''}</p><p className="mt-1 font-semibold text-slate-200">{step.title}</p><p className="mt-2 text-xs text-slate-500">Evidence: {step.expectedEvidence.join(', ') || 'missing'}</p></div>)}</div>}
          {toolCall && <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/10 p-4 text-sm text-indigo-100"><p className="font-bold">App Builder tool finished</p><p className="mt-2 font-mono text-xs">{toolCall.toolName}</p><p>Manifest: {toolCall.environment.manifestPath}</p><p>Action layer: {toolCall.actionLayer.actionLayer} / {toolCall.actionLayer.runtimeAdapter}</p><p>Audit written: {String(toolCall.evidence.auditWritten)}</p><p className="mt-2 text-xs text-indigo-200/80">{toolCall.evidence.note}</p></div>}
          {toolCall?.notification && <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 p-4 text-sm text-sky-100"><p className="font-bold">{toolCall.notification.title}</p><p className="mt-2">{toolCall.notification.message}</p><p className="mt-2 text-xs text-sky-200/80">Next: {toolCall.notification.nextAction}</p></div>}
          {execution && <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-100"><p className="font-bold">Implementation PR created</p><p className="mt-2">Repository: {execution.repository}</p><p>Branch: {execution.branchName}</p><p>Generated files: {execution.generatedFiles.length}</p><a href={execution.pullRequestUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-emerald-200 underline">Open PR #{execution.pullRequestNumber}<ExternalLink className="h-3.5 w-3.5" /></a><p className="mt-3 text-xs text-emerald-200/80">{execution.evidence.note}</p></div>}
        </section>
      </div>
    </div>
  );
}
