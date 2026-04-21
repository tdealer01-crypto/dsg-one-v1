'use client';

import React from 'react';
import { Lock, FileWarning, Key, RefreshCcw } from 'lucide-react';

export function GovernanceView() {
  const policies = [
    { id: 'pol_base_1', name: 'Global Data Minimization', rules: 4, type: 'Pre-Execution' },
    { id: 'pol_auth_3', name: 'Strict Identity Binding', rules: 2, type: 'Authentication' },
    { id: 'pol_fin_2', name: 'Financial Transaction Audit', rules: 7, type: 'Post-Execution' },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 items-center flex gap-2">
            Governance Policies
          </h1>
          <p className="text-slate-500 mt-1">Configure control flow rules and organizational policy checks.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
          { label: 'Active Policies', val: '12', icon: Lock },
          { label: 'Policy Infractions (30d)', val: '142', icon: FileWarning, color: 'text-rose-400' },
          { label: 'Rule Sync Status', val: 'Synced', icon: RefreshCcw, color: 'text-indigo-400' },
        ].map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="flex justify-between items-start text-slate-400 mb-2">
                <span className="text-sm font-medium">{item.label}</span>
                <Icon className={`w-4 h-4 ${item.color || 'text-slate-500'}`} />
              </div>
              <div className="text-3xl font-bold text-slate-200">{item.val}</div>
            </div>
          );
        })}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
          <h3 className="font-semibold text-slate-200">Active Rule Definitions</h3>
          <button className="text-sm text-indigo-400 hover:text-indigo-300 font-medium transition">Create Rule</button>
        </div>
        <div className="divide-y divide-slate-800">
          {policies.map((pol) => (
            <div key={pol.id} className="px-6 py-4 hover:bg-slate-800/30 transition-colors flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center border border-slate-700">
                  <Key className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h4 className="text-slate-200 font-medium">{pol.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-xs text-slate-500">{pol.id}</span>
                    <span className="text-slate-700 text-xs">•</span>
                    <span className="text-xs text-slate-400">{pol.rules} Active Checks</span>
                  </div>
                </div>
              </div>
              <div>
                <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-xs font-semibold uppercase tracking-wider border border-slate-700">
                  {pol.type}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
