'use client';

import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Lock, Search, ShieldAlert, Sparkles } from 'lucide-react';
import type { FlowOrchestration } from '@/lib/dsg/flow-studio/types';

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: { code: string; message?: string } };

type McpData = {
  action: string;
  status?: number;
  message?: string;
  query?: string;
  title?: string | null;
  snippet?: string;
};

const prompts = [
  'Check Vercel deployment status and record evidence',
  'Change the app background color to purple and set title to DSG Flow Studio',
  'Fetch https://en.wikipedia.org and summarize the response boundary',
  'Search Wikipedia for Quantum Computing and extract the first result',
];

export default function FlowStudioPage() {
  const [goal, setGoal] = useState(prompts[0]);
  const [loading, setLoading] = useState(false);
  const [orchestration, setOrchestration] = useState<FlowOrchestration | null>(null);
  const [mcpResult, setMcpResult] = useState<McpData | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generatePlan(event?: React.FormEvent) {
    event?.preventDefault();
    const trimmed = goal.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setMcpResult(null);
    try {
      const response = await fetch('/api/dsg/flow-studio/orchestrator', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ goal: trimmed }),
      });
      const json = (await response.json()) as ApiResponse<FlowOrchestration>;
      if (!response.ok || !json.ok) throw new Error(!json.ok ? json.error.code : 'FLOW_STUDIO_PLAN_FAILED');
      setOrchestration(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'FLOW_STUDIO_PLAN_FAILED');
    } finally {
      setLoading(false);
    }
  }

  async function runWikipediaExtract() {
    const query = orchestration?.plan.processedInput.extractedEntities.searchQuery?.[0] || goal.trim() || 'Technology';
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/dsg/flow-studio/mcp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'extract', params: { query } }),
      });
      const json = (await response.json()) as ApiResponse<McpData>;
      if (!response.ok || !json.ok) throw new Error(!json.ok ? json.error.code : 'FLOW_STUDIO_MCP_FAILED');
      setMcpResult(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'FLOW_STUDIO_MCP_FAILED');
    } finally {
      setLoading(false);
    }
  }

  async function runSafeNavigate() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/dsg/flow-studio/mcp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'navigate', params: { url: 'https://en.wikipedia.org' } }),
      });
      const json = (await response.json()) as ApiResponse<McpData>;
      if (!response.ok || !json.ok) throw new Error(!json.ok ? json.error.code : 'FLOW_STUDIO_MCP_FAILED');
      setMcpResult(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'FLOW_STUDIO_MCP_FAILED');
    } finally {
      setLoading(false);
    }
  }

  const plan = orchestration?.plan;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl border border-indigo-500/20 bg-indigo-500/10 p-6 shadow-2xl shadow-indigo-950/30 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-indigo-200">
                <Sparkles className="h-3.5 w-3.5" /> DSG Flow Studio
              </div>
              <h1 className="text-3xl font-black tracking-tight md:text-5xl">Hardened deterministic action planner</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
                รวมแนวคิดจาก dsg-Flow-Studio แบบปลอดภัย: Vercel takeover plan, dry-run theme mutation, allowlisted URL/Wikipedia search, และ proof boundary โดยไม่เปิด runtime mutation public.
              </p>
            </div>
            <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-100">
              <div className="mb-2 flex items-center gap-2 font-bold"><ShieldAlert className="h-4 w-4" /> Boundary</div>
              <p>Mutate เป็น dry-run และ route ที่เสี่ยงต้องมี auth gate. MCP fetch จำกัด host ที่ allowlist.</p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <form onSubmit={generatePlan} className="space-y-4">
              <label className="text-sm font-bold text-slate-300">Goal</label>
              <textarea
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                className="h-36 w-full resize-none rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm leading-6 text-slate-100 outline-none focus:border-indigo-500"
                placeholder="Describe the action you want Flow Studio to plan..."
              />
              <div className="flex flex-wrap gap-2">
                {prompts.map((item) => (
                  <button key={item} type="button" onClick={() => setGoal(item)} className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">
                    {item}
                  </button>
                ))}
              </div>
              <button disabled={loading || !goal.trim()} className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50">
                {loading ? 'Processing...' : 'Generate plan'} <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>

          <div className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="flex items-center gap-2 text-lg font-bold"><Lock className="h-5 w-5 text-emerald-400" /> Safety gates</h2>
            <div className="space-y-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3"><b>Vercel:</b> takeover/evidence plan only</div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3"><b>Mutation:</b> dry-run only unless verified context</div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3"><b>MCP:</b> allowlisted public hosts only</div>
            </div>
            <button onClick={runSafeNavigate} disabled={loading} className="w-full rounded-2xl border border-slate-700 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-slate-800">
              Test allowlisted navigate
            </button>
            <button onClick={runWikipediaExtract} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-700 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-slate-800">
              <Search className="h-4 w-4" /> Test Wikipedia extract
            </button>
          </div>
        </section>

        {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}

        {plan && (
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="mb-4 text-xl font-bold">Plan</h2>
              <div className="space-y-3">
                {plan.stages.map((stage) => (
                  <div key={stage.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-bold text-slate-100">{stage.title}</p>
                        <p className="mt-1 text-sm text-slate-400">{stage.purpose}</p>
                      </div>
                      <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] uppercase text-slate-400">{stage.type}</span>
                    </div>
                    {stage.approvalRequired && <p className="mt-2 text-xs font-bold text-amber-300">approval required</p>}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
                <h2 className="mb-4 text-xl font-bold">Thoughts</h2>
                <div className="space-y-2">
                  {orchestration?.thoughts.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300">
                      <span className="mr-2 font-mono text-xs text-indigo-300">{item.category}</span>{item.message}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
                <h2 className="mb-4 text-xl font-bold">Evidence target</h2>
                <ul className="space-y-2 text-sm text-slate-300">
                  {plan.definitionOfSuccess.evidence.map((item) => <li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-400" />{item}</li>)}
                </ul>
              </div>
            </div>
          </section>
        )}

        {mcpResult && (
          <section className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5">
            <h2 className="mb-3 text-xl font-bold text-emerald-100">MCP / public search result</h2>
            <pre className="overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs text-emerald-100">{JSON.stringify(mcpResult, null, 2)}</pre>
          </section>
        )}
      </div>
    </main>
  );
}
