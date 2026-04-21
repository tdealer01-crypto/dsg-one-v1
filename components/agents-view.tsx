'use client';

import React from 'react';
import { Terminal, Plus, Key, Copy, MoreHorizontal } from 'lucide-react';

export function AgentsView() {
  const agents = [
    { id: 'ag_prod_8f9x2j', name: 'Compliance Checker', status: 'active', calls: '12.4k', lastRun: '2m ago' },
    { id: 'ag_prod_4h1x9l', name: 'Customer Triage', status: 'active', calls: '8.1k', lastRun: '5m ago' },
    { id: 'ag_test_9p3m4z', name: 'Finance Audit Agent', status: 'paused', calls: '0', lastRun: 'never' },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 items-center flex gap-2">
            Agents & Runtime
          </h1>
          <p className="text-slate-500 mt-1">Manage API-key-based execution contexts and agents.</p>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          <Plus className="w-4 h-4" /> New Agent
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900/50 border-b border-slate-800 text-slate-500">
            <tr>
              <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Agent Name</th>
              <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Agent ID</th>
              <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Status</th>
              <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs text-right">Calls (30d)</th>
              <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs text-right">Last Run</th>
              <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {agents.map((agent) => (
              <tr key={agent.id} className="hover:bg-slate-800/20 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-slate-800 border border-slate-700 flex items-center justify-center">
                      <Terminal className="w-4 h-4 text-indigo-400" />
                    </div>
                    {agent.name}
                  </div>
                </td>
                <td className="px-6 py-4 font-mono text-emerald-400/80 text-xs">{agent.id}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    agent.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    {agent.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right text-slate-400">{agent.calls}</td>
                <td className="px-6 py-4 text-right text-slate-400">{agent.lastRun}</td>
                <td className="px-6 py-4 text-center">
                  <button className="text-slate-500 hover:text-slate-300">
                    <MoreHorizontal className="w-5 h-5 mx-auto" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="font-semibold text-slate-200 mb-2 flex items-center gap-2">
          <Key className="w-4 h-4 text-slate-400" /> Current Runtime API Key
        </h3>
        <p className="text-sm text-slate-500 mb-4 items-center">
          This key provides runtime execution access. It only displays once upon generation.
        </p>
        <div className="flex gap-3">
          <div className="bg-slate-950 border border-slate-800 rounded px-4 py-2 flex-1 font-mono text-slate-400 text-sm flex justify-between items-center cursor-not-allowed opacity-70">
            dsg_rk_*********************************************
          </div>
          <button className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded px-4 py-2 text-slate-300 flex items-center gap-2 text-sm font-medium transition">
             Roll Key
          </button>
        </div>
      </div>
    </div>
  );
}
