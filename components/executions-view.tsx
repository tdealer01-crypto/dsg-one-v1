'use client';

import React from 'react';
import { Search, ShieldCheck, AlertCircle, Clock, ChevronRight } from 'lucide-react';

export function ExecutionsView() {
  const executions = [
    { reqId: 'req_9281a', agent: 'Compliance Checker', status: 'Allowed', latency: '192ms', timestamp: '2026-04-18 14:22:01' },
    { reqId: 'req_9281b', agent: 'Customer Triage', status: 'Allowed', latency: '145ms', timestamp: '2026-04-18 14:21:45' },
    { reqId: 'req_9281c', agent: 'Compliance Checker', status: 'Blocked', latency: '89ms', timestamp: '2026-04-18 14:18:12', reason: 'Policy Violation: PII detected' },
    { reqId: 'req_9281d', agent: 'Finance Audit Agent', status: 'Blocked', latency: '40ms', timestamp: '2026-04-18 14:15:00', reason: 'Unverified Identity' },
    { reqId: 'req_9281e', agent: 'Customer Triage', status: 'Allowed', latency: '166ms', timestamp: '2026-04-18 14:12:33' },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 items-center flex gap-2">
            Execution & Audit Log
          </h1>
          <p className="text-slate-500 mt-1">Reviewable traces, state transitions, and execution decisions.</p>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder="Filter by trace ID, agent, or policy outcome..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500/50 placeholder:text-slate-600 transition-colors"
          />
        </div>
        <select className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500/50 appearance-none">
          <option>All Outcomes</option>
          <option>Allowed</option>
          <option>Blocked</option>
        </select>
        <button className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition">
          Export Log
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900/50 border-b border-slate-800 text-slate-500">
            <tr>
              <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Request ID</th>
              <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Agent</th>
              <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Decision</th>
              <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs text-right">Latency</th>
              <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs text-right">Timestamp (UTC)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {executions.map((exec) => (
              <tr key={exec.reqId} className="hover:bg-slate-800/20 transition-colors cursor-pointer group">
                <td className="px-6 py-4 font-mono text-slate-400 text-xs flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 transition" />
                  {exec.reqId}
                </td>
                <td className="px-6 py-4 text-slate-300">{exec.agent}</td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold w-fit ${
                      exec.status === 'Allowed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      {exec.status === 'Allowed' ? <ShieldCheck className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                      {exec.status}
                    </span>
                    {exec.reason && <span className="text-xs text-slate-500 font-mono mt-1">{exec.reason}</span>}
                  </div>
                </td>
                <td className="px-6 py-4 text-right text-slate-400 font-mono text-xs"><Clock className="w-3 h-3 inline mr-1 text-slate-600"/>{exec.latency}</td>
                <td className="px-6 py-4 text-right text-slate-400 font-mono text-xs">{exec.timestamp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
