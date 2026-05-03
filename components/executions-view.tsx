'use client';

import React from 'react';
import { AlertCircle, CheckCircle2, Clock, Search, ShieldCheck } from 'lucide-react';

const evidenceRows = [
  { id: 'goal-lock', name: 'Goal lock record', state: 'Available through App Builder API', proof: 'goalHash' },
  { id: 'prd-plan', name: 'PRD and proposed plan', state: 'Available after Generate PRD + plan', proof: 'proposed_plan + gate_result' },
  { id: 'approval', name: 'Approval record', state: 'Available after user approves visible plan', proof: 'approvalHash' },
  { id: 'handoff', name: 'Runtime handoff', state: 'Available after approval', proof: 'planHash + allowed tools' },
  { id: 'execution', name: 'Action execution log', state: 'Missing until Step 16 runtime exists', proof: 'not claimed' },
  { id: 'deploy', name: 'Preview or production deployment proof', state: 'Missing until deploy proof is recorded', proof: 'not claimed' },
];

export function ExecutionsView() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-100">Execution & Evidence Boundary</h1>
          <p className="mt-1 text-slate-500">No seeded execution rows. This view shows what proof exists or remains missing.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-5 text-sm leading-7 text-rose-100">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-rose-200">
          <AlertCircle className="h-4 w-4" /> Claim boundary
        </div>
        <p className="mt-3">
          Previous seeded request ids and allowed/blocked outcomes were removed because they looked like real audit events. Real executions must come from runtime evidence, audit ledger rows, deployment proof, and replay proof.
        </p>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search will connect to real evidence once Step 16 runtime evidence exists..."
            disabled
            className="w-full rounded-lg border border-slate-800 bg-slate-900 pl-10 pr-4 py-2 text-sm text-slate-500 outline-none placeholder:text-slate-600"
          />
        </div>
        <button disabled className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-600">
          Export disabled until evidence exists
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-900/50 text-slate-500">
            <tr>
              <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider">Evidence item</th>
              <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider">Current state</th>
              <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider">Proof field</th>
              <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider">Claim status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {evidenceRows.map((row) => {
              const missing = row.proof === 'not claimed';
              return (
                <tr key={row.id} className="hover:bg-slate-800/20">
                  <td className="px-6 py-4 font-medium text-slate-200">{row.name}</td>
                  <td className="px-6 py-4 text-slate-400">{row.state}</td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">{row.proof}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold ${missing ? 'border-amber-500/25 bg-amber-500/10 text-amber-200' : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'}`}>
                      {missing ? <Clock className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      {missing ? 'Missing' : 'Step 15 proof field'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-sm leading-7 text-slate-400">
        <div className="flex items-center gap-2 font-bold text-slate-200"><ShieldCheck className="h-4 w-4 text-indigo-400" /> Consumer-safe rule</div>
        <p className="mt-2">If evidence is missing, the UI must say missing. It must not convert demo data into production success, uptime, latency, audit completeness, or execution counts.</p>
      </div>
    </div>
  );
}
