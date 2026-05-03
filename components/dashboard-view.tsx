'use client';

import React from 'react';
import { Activity, AlertTriangle, FileText, ShieldCheck, Terminal, Zap } from 'lucide-react';

const readinessItems = [
  {
    label: 'Step 15 App Builder backend',
    value: 'Present',
    detail: 'Goal lock, PRD, plan, gate, approval, and handoff routes exist in repo.',
    icon: FileText,
  },
  {
    label: 'Action execution proof',
    value: 'Missing',
    detail: 'No shell/file/deploy execution proof is claimed from this dashboard.',
    icon: Terminal,
  },
  {
    label: 'Production readiness claim',
    value: 'Blocked',
    detail: 'Requires CI, deployment, runtime proof ids, replay proof, and completion gate evidence.',
    icon: AlertTriangle,
  },
  {
    label: 'User protection boundary',
    value: 'Visible',
    detail: 'Missing evidence is shown as missing instead of converted into success metrics.',
    icon: ShieldCheck,
  },
];

const proofRows = [
  ['Locked goal', 'Available after user creates App Builder job'],
  ['PRD draft', 'Generated only after a job exists and plan is requested'],
  ['Plan gate', 'PASS / REVIEW / BLOCK from Step 15 gate logic'],
  ['Approval hash', 'Missing until user approves a visible plan'],
  ['Runtime handoff', 'Authorization data only; not command execution'],
  ['Execution evidence', 'Missing until Step 16 runtime records it'],
];

export function DashboardView() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-100">Mission Control</h1>
        <p className="mt-1 text-slate-500">User-safe overview of what is proven, what is missing, and what must not be claimed yet.</p>
      </div>

      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5 text-sm leading-7 text-amber-100">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-amber-200">
          <ShieldCheck className="h-4 w-4" /> No mock metrics
        </div>
        <p className="mt-3">
          This dashboard intentionally avoids fake execution counts, fake latency, fake 100% proof rates, and fake green readiness. Use the App Builder Agent tab to create real Step 15 records. Production readiness remains blocked until runtime evidence exists.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {readinessItems.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="mb-3 flex items-start justify-between gap-3 text-slate-400">
                <span className="text-sm font-medium">{item.label}</span>
                <Icon className="h-4 w-4 text-indigo-400" />
              </div>
              <div className="mb-2 text-2xl font-bold text-slate-200">{item.value}</div>
              <div className="text-xs leading-5 text-slate-500">{item.detail}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 lg:col-span-2">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-200">Builder journey</h3>
            <div className="rounded bg-slate-800 px-2 py-1 font-mono text-xs text-slate-400">/api/dsg/app-builder/*</div>
          </div>
          <div className="space-y-3">
            {[
              ['1', 'User goal', 'User describes what to build.'],
              ['2', 'Goal lock', 'Server normalizes goal and records goalHash.'],
              ['3', 'PRD + proposed plan', 'Server creates deterministic planning contract.'],
              ['4', 'Gate + approval', 'Blocked plans cannot be approved. High-risk plans require approval.'],
              ['5', 'Runtime handoff', 'Creates authorization data for Step 16. It does not execute actions.'],
            ].map(([num, title, detail]) => (
              <div key={num} className="grid grid-cols-[40px_1fr] gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/10 text-sm font-bold text-indigo-300">{num}</div>
                <div>
                  <p className="font-semibold text-slate-200">{title}</p>
                  <p className="mt-1 text-sm text-slate-500">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="mb-4 font-semibold text-slate-200">Evidence ledger requirements</h3>
          <div className="space-y-3">
            {proofRows.map(([label, detail]) => (
              <div key={label} className="rounded border border-slate-800/70 bg-slate-950/50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-300">{label}</span>
                  <span className="font-mono text-xs text-slate-500">tracked</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
              </div>
            ))}
          </div>
          <button className="mt-4 w-full rounded-lg border border-slate-700 py-2 text-sm text-slate-300 transition hover:bg-slate-800">
            Open App Builder Agent
          </button>
        </div>
      </div>
    </div>
  );
}
