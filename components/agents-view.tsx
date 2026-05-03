'use client';

import React from 'react';
import { Copy, Key, Lock, MoreHorizontal, Plus, Terminal } from 'lucide-react';

const agentCapabilities = [
  { id: 'app-builder-step-15', name: 'App Builder Planning Agent', status: 'planning-ready', scope: 'Goal, PRD, plan, gate, approval, handoff', proof: 'Step 15 API routes' },
  { id: 'runtime-step-16', name: 'Action Runtime Executor', status: 'not-enabled', scope: 'Write files, run commands, test, build, deploy', proof: 'Missing Step 16 runtime evidence' },
  { id: 'production-claim-gate', name: 'Production Claim Gate', status: 'blocked', scope: 'Production readiness claim', proof: 'Requires deployment + runtime proof ids' },
];

export function AgentsView() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-100">Agents & Runtime</h1>
          <p className="mt-1 text-slate-500">Capability inventory. Nothing here claims live execution unless runtime evidence exists.</p>
        </div>
        <button disabled className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-500">
          <Plus className="h-4 w-4" /> New Agent disabled
        </button>
      </div>

      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5 text-sm leading-7 text-amber-100">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-amber-200">
          <Lock className="h-4 w-4" /> Permission boundary
        </div>
        <p className="mt-3">The App Builder Agent can prepare an approved handoff. Runtime execution, API keys, shell commands, file writes, and deployment require Step 16 evidence before the UI may call them active.</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-900/50 text-slate-500">
            <tr>
              <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider">Capability</th>
              <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider">Scope</th>
              <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-right">Proof</th>
              <th className="px-6 py-4 text-center text-xs font-medium uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {agentCapabilities.map((agent) => {
              const ready = agent.status === 'planning-ready';
              return (
                <tr key={agent.id} className="hover:bg-slate-800/20">
                  <td className="px-6 py-4 font-medium text-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded border border-slate-700 bg-slate-800">
                        <Terminal className="h-4 w-4 text-indigo-400" />
                      </div>
                      <div>
                        <p>{agent.name}</p>
                        <p className="mt-0.5 font-mono text-xs text-slate-500">{agent.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-400">{agent.scope}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${ready ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-amber-500/20 bg-amber-500/10 text-amber-200'}`}>
                      {agent.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-xs text-slate-500">{agent.proof}</td>
                  <td className="px-6 py-4 text-center">
                    <button disabled className="text-slate-600">
                      <MoreHorizontal className="mx-auto h-5 w-5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-200">
          <Key className="h-4 w-4 text-slate-400" /> Runtime API key
        </h3>
        <p className="mb-4 text-sm text-slate-500">No runtime key is displayed in this UI. Keys must be bound server-side and proven by Step 16 runtime evidence before execution is enabled.</p>
        <div className="flex gap-3">
          <div className="flex flex-1 cursor-not-allowed items-center justify-between rounded border border-slate-800 bg-slate-950 px-4 py-2 font-mono text-sm text-slate-600">
            not-bound-in-ui
          </div>
          <button disabled className="flex items-center gap-2 rounded border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-600">
            <Copy className="h-4 w-4" /> Copy disabled
          </button>
        </div>
      </div>
    </div>
  );
}
