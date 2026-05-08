'use client';

import { useState } from 'react';
import { ExternalLink, GitBranch, Loader2, Play, Rocket, ShieldCheck } from 'lucide-react';

const TOOL_NAME = 'dsg.app_builder.launch_agent_runtime';
const DEFAULT_COMMAND = 'สร้างแอป PC เสมือนที่มี Windows ต่อเน็ตแล้ว มีจอมอนิเตอร์ในแอป มี remote mouse API ให้ agent จากที่อื่นควบคุมเมาส์ได้ และมี DSG governance ตรวจ invariant ก่อนทุก action พร้อม audit/evidence proof';
const requestHeaders = {
  'content-type': 'application/json',
  'x-dsg-workspace-id': '00000000-0000-4000-8000-000000000001',
  'x-dsg-actor-id': 'customer',
};

type RouteResult = {
  intent: string;
  status: string;
  actionLabel: string;
  endpoint?: string;
  method?: string;
  payload?: unknown;
  userBenefit: string;
  truthBoundary: string;
  evidence: string[];
};

type BuildStep = {
  label: string;
  status: 'waiting' | 'running' | 'done' | 'error';
  detail?: string;
};

type BuildOutput = {
  pullRequestUrl?: string;
  pullRequestNumber?: number;
  branchName?: string;
  repository?: string;
  generatedFiles?: number;
  claimStatus?: string;
};

const initialBuildSteps: BuildStep[] = [
  { label: 'Route requirement', status: 'waiting' },
  { label: 'Create governed plan', status: 'waiting' },
  { label: 'Approve execution', status: 'waiting' },
  { label: 'Prepare runtime handoff', status: 'waiting' },
  { label: 'Generate pull request evidence', status: 'waiting' },
];

async function apiPost(path: string, body?: unknown) {
  const res = await fetch(path, {
    method: 'POST',
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({ ok: false, error: { message: 'INVALID_JSON_RESPONSE' } }));
  if (!res.ok || !json.ok) throw new Error(json.error?.message || json.error?.code || `HTTP_${res.status}`);
  return json.data;
}

async function routeCommandRequest(command: string): Promise<RouteResult> {
  const res = await fetch('/api/dsg/agent-runtime/commands', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ command, userBenefit: 'User gets a governed build job instead of another confirmation question.' }),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error?.message || json.error?.code || `HTTP_${res.status}`);
  return json.data;
}

function buildGoalPayload(command: string, route: RouteResult) {
  const payload = (route.payload || {}) as Record<string, unknown>;
  const gapGoal = typeof payload.recommendedBuilderGoal === 'string' ? payload.recommendedBuilderGoal : undefined;
  const directGoal = typeof payload.goal === 'string' ? payload.goal : undefined;
  const successCriteria = Array.isArray(payload.successCriteria)
    ? payload.successCriteria.filter((item): item is string => typeof item === 'string')
    : [
        'Virtual PC monitor surface is visible in the app',
        'Remote mouse API contract exists for external agents',
        'DSG invariant gate evaluates every remote mouse action before execution',
        'Every governed action returns audit/evidence output',
        'Pull request evidence is returned before production deployment',
      ];
  const constraints = Array.isArray(payload.constraints)
    ? payload.constraints.filter((item): item is string => typeof item === 'string')
    : [
        'Do not claim a real Windows VM is provisioned until a verified provider proves it',
        'Use real API responses only',
        'Remote mouse actions must be policy-gated and auditable',
        'External login, install, privileged settings, publish, or destructive actions require approval/takeover',
        'Return visible evidence or a clear error',
      ];

  return {
    goal: gapGoal || directGoal || command,
    successCriteria,
    constraints,
    targetStack: {
      frontend: 'nextjs',
      backend: 'next-api',
      database: 'supabase-postgres',
      auth: 'none',
      deploy: 'vercel',
    },
  };
}

export function AgentCommandCenter() {
  const [command, setCommand] = useState(DEFAULT_COMMAND);
  const [busy, setBusy] = useState(false);
  const [builderBusy, setBuilderBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<RouteResult | null>(null);
  const [buildSteps, setBuildSteps] = useState<BuildStep[]>(initialBuildSteps);
  const [buildOutput, setBuildOutput] = useState<BuildOutput | null>(null);

  function markStep(index: number, status: BuildStep['status'], detail?: string) {
    setBuildSteps((current) => current.map((step, stepIndex) => stepIndex === index ? { ...step, status, detail } : step));
  }

  function resetRun() {
    setError('');
    setResult(null);
    setBuildOutput(null);
    setBuildSteps(initialBuildSteps);
  }

  async function routeCommand() {
    setBusy(true);
    resetRun();
    try {
      markStep(0, 'running');
      const routed = await routeCommandRequest(command);
      setResult(routed);
      markStep(0, 'done', `${routed.intent}/${routed.status}`);
    } catch (err) {
      markStep(0, 'error', 'Failed here');
      setError(err instanceof Error ? err.message : 'Command routing failed');
    } finally {
      setBusy(false);
    }
  }

  async function runBuilderRequest(routeOverride?: RouteResult) {
    const activeRoute = routeOverride || result;
    if (!activeRoute) return;
    setBuilderBusy(true);
    setError('');
    setBuildOutput(null);
    try {
      if (activeRoute.status === 'blocked') throw new Error('COMMAND_BLOCKED_BY_POLICY');

      markStep(1, 'running');
      const created = await apiPost('/api/dsg/app-builder/jobs', buildGoalPayload(command, activeRoute));
      const planned = await apiPost(`/api/dsg/app-builder/jobs/${created.id}/plan`);
      markStep(1, 'done', planned.id || created.id);

      markStep(2, 'running');
      const approved = await apiPost(`/api/dsg/app-builder/jobs/${planned.id}/approval`, {
        decision: 'APPROVE',
        reason: 'User clicked Build Now from Agent Command Center.',
      });
      markStep(2, 'done', approved.approvalHash || approved.status);

      markStep(3, 'running');
      const handoff = await apiPost(`/api/dsg/app-builder/jobs/${approved.id}/runtime-handoff`);
      markStep(3, 'done', handoff.runtimeStatus || 'READY');

      markStep(4, 'running');
      const executed = await apiPost(`/api/dsg/app-builder/jobs/${approved.id}/tool-call`, {
        toolName: TOOL_NAME,
        arguments: { mode: 'agent_runtime_fullstack_pr' },
      });
      const output = executed.toolCall?.output || {};
      markStep(4, 'done', output.pullRequestUrl || executed.job?.status || 'EXECUTED');
      setBuildOutput({
        pullRequestUrl: output.pullRequestUrl,
        pullRequestNumber: output.pullRequestNumber,
        branchName: output.branchName,
        repository: output.repository,
        generatedFiles: Array.isArray(output.generatedFiles) ? output.generatedFiles.length : undefined,
        claimStatus: executed.job?.claimStatus || executed.toolCall?.claimStatus,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Builder execution failed');
      setBuildSteps((current) => current.map((step) => step.status === 'running' ? { ...step, status: 'error' as const, detail: 'Failed here' } : step));
    } finally {
      setBuilderBusy(false);
    }
  }

  async function buildNow() {
    setBusy(true);
    resetRun();
    try {
      markStep(0, 'running');
      const routed = await routeCommandRequest(command);
      setResult(routed);
      markStep(0, 'done', `${routed.intent}/${routed.status}`);
      setBusy(false);
      await runBuilderRequest(routed);
    } catch (err) {
      markStep(0, 'error', 'Failed here');
      setError(err instanceof Error ? err.message : 'Build Now failed');
      setBusy(false);
    }
  }

  const canRunBuilder = Boolean(result && result.status !== 'blocked' && (result.intent === 'build_app' || result.intent === 'resolve_capability_gap' || result.status === 'approval_required' || result.status === 'builder_required'));
  const running = busy || builderBusy;

  return (
    <section className="rounded-2xl border border-[#C8A24D] bg-[#071326] p-4 text-[#F5F7FA] shadow-[0_0_36px_rgba(200,162,77,0.18)]">
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#E0B95B]">Agent Command Center</p>
      <h2 className="mt-2 text-xl font-black">Build Governed Virtual PC App</h2>
      <p className="mt-1 text-sm text-[#D7D9DE]">Build Now routes the requirement, creates the governed plan, approves execution, prepares runtime handoff, and returns PR evidence.</p>

      <textarea
        value={command}
        onChange={(event) => setCommand(event.target.value)}
        className="mt-4 h-28 w-full rounded-xl border border-[#C8A24D]/50 bg-[#0C2340] p-3 text-sm text-white outline-none"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={buildNow}
          disabled={running || !command.trim()}
          className="inline-flex items-center gap-2 rounded-xl border border-[#C8A24D] bg-[#E0B95B] px-4 py-3 text-sm font-black text-[#071326] disabled:opacity-50"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
          Build Now
        </button>
        <button
          onClick={routeCommand}
          disabled={running || !command.trim()}
          className="inline-flex items-center gap-2 rounded-xl border border-[#C8A24D] bg-[#0C2340] px-4 py-3 text-sm font-black text-[#E0B95B] disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Route Only
        </button>
        <button
          onClick={() => runBuilderRequest()}
          disabled={!canRunBuilder || running}
          className="inline-flex items-center gap-2 rounded-xl border border-[#C8A24D] bg-[#0C2340] px-4 py-3 text-sm font-black text-[#E0B95B] disabled:opacity-40"
        >
          {builderBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
          Run Builder Request
        </button>
      </div>

      {error ? <div className="mt-3 rounded-xl border border-[#D9363E] bg-[#D9363E]/15 p-3 text-sm text-[#ffb4b8]">{error}</div> : null}

      {result ? (
        <div className="mt-4 grid gap-3 rounded-xl border border-[#C8A24D]/40 bg-[#0C2340] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[#C8A24D]/50 px-2.5 py-1 text-[11px] font-black text-[#E0B95B]">{result.status}</span>
            <span className="rounded-full border border-[#D9363E]/40 px-2.5 py-1 text-[11px] font-black text-[#ffb4b8]">{result.intent}</span>
          </div>
          <p className="font-black">{result.actionLabel}</p>
          {result.endpoint ? <p className="font-mono text-xs text-[#D7D9DE]">{result.method || 'GET'} {result.endpoint}</p> : null}
          <p className="text-sm text-[#D7D9DE]">{result.userBenefit}</p>
          <p className="rounded-lg border border-[#C8A24D]/20 bg-[#071326] p-2 text-xs text-[#D7D9DE]"><ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-[#E0B95B]" />{result.truthBoundary}</p>
          <div className="flex flex-wrap gap-2">{result.evidence.map((item) => <span key={item} className="rounded-lg border border-[#C8A24D]/30 px-2 py-1 text-[11px] text-[#E0B95B]">{item}</span>)}</div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-2">
        {buildSteps.map((step, index) => (
          <div key={step.label} className="rounded-xl border border-[#C8A24D]/25 bg-[#0C2340] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-black">{index + 1}. {step.label}</p>
              {step.status === 'running' ? <Loader2 className="h-4 w-4 animate-spin text-[#E0B95B]" /> : step.status === 'done' ? <ShieldCheck className="h-4 w-4 text-[#E0B95B]" /> : step.status === 'error' ? <ShieldCheck className="h-4 w-4 text-[#D9363E]" /> : <GitBranch className="h-4 w-4 text-[#D7D9DE]" />}
            </div>
            <p className="mt-1 text-xs text-[#D7D9DE]">{step.detail || step.status}</p>
          </div>
        ))}
      </div>

      {buildOutput ? (
        <div className="mt-4 rounded-xl border border-[#C8A24D]/40 bg-[#0C2340] p-3 text-sm text-[#D7D9DE]">
          <p className="font-black text-[#E0B95B]">Builder Evidence Created</p>
          <p>Claim status: {buildOutput.claimStatus || 'IMPLEMENTED_UNVERIFIED'}</p>
          <p>Repository: {buildOutput.repository || 'pending'}</p>
          <p>Branch: {buildOutput.branchName || 'pending'}</p>
          <p>Generated files: {buildOutput.generatedFiles ?? 'pending'}</p>
          {buildOutput.pullRequestUrl ? <a href={buildOutput.pullRequestUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 rounded-xl border border-[#C8A24D]/50 px-3 py-2 text-xs font-black text-[#E0B95B]">Open Pull Request #{buildOutput.pullRequestNumber}<ExternalLink className="h-4 w-4" /></a> : null}
        </div>
      ) : null}
    </section>
  );
}
