'use client';

import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Zap, ShieldCheck, AlertTriangle } from 'lucide-react';

const mockChartData = [
  { time: '00:00', val: 400 },
  { time: '04:00', val: 300 },
  { time: '08:00', val: 550 },
  { time: '12:00', val: 800 },
  { time: '16:00', val: 650 },
  { time: '20:00', val: 900 },
  { time: '24:00', val: 850 },
];

export function DashboardView() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 items-center flex gap-2">
          Mission Control
        </h1>
        <p className="text-slate-500 mt-1">Live visibility into AI runtime execution and readiness.</p>
      </div>

      {/* KPIS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Executions', value: '42,891', diff: '+12%', status: 'text-emerald-400', icon: Zap },
          { label: 'Policy Blocks', value: '142', diff: '+2%', status: 'text-indigo-400', icon: ShieldCheck },
          { label: 'Avg Latency', value: '184ms', diff: '-14ms', status: 'text-emerald-400', icon: Activity },
          { label: 'System Readiness', value: 'Green', diff: '100% Up', status: 'text-emerald-400', icon: AlertTriangle, bg: 'bg-emerald-500/10' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition duration-300">
              <div className="flex justify-between items-start text-slate-400 mb-2">
                <span className="text-sm font-medium">{stat.label}</span>
                <Icon className={`w-4 h-4 ${stat.status}`} />
              </div>
              <div className="text-2xl font-bold text-slate-200 mb-1">{stat.value}</div>
              <div className={`text-xs ${stat.status} font-medium tracking-wide`}>{stat.diff}</div>
            </div>
          );
        })}
      </div>

      {/* Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-slate-200">Execution Volume (24h)</h3>
            <div className="text-xs font-mono bg-slate-800 px-2 py-1 rounded text-slate-400">POST /api/execute</div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockChartData}>
                <defs>
                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="time" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#475569" fontSize={12} tickLine={false} axisLine={false} width={40} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                  itemStyle={{ color: '#818cf8' }}
                />
                <Area type="monotone" dataKey="val" stroke="#818cf8" strokeWidth={2} fillOpacity={1} fill="url(#colorVal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Audit Status */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col">
          <h3 className="font-semibold text-slate-200 mb-4">Runtime Evidence Sync</h3>
          
          <div className="space-y-4 flex-1">
            {[
              { label: 'Ledger Match Rate', val: '100%', detail: 'Verified' },
              { label: 'Replay Completeness', val: '100%', detail: 'Syncing' },
              { label: 'Gate Decision Accuracy', val: '99.9%', detail: '0 False Allows' },
              { label: 'Proof Presence', val: '100%', detail: 'Tamper Evident' },
            ].map((item, i) => (
              <div key={i} className="flex justify-between items-center p-3 bg-slate-950/50 rounded border border-slate-800/50">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-slate-300">{item.label}</span>
                  <span className="text-xs text-slate-500 mt-0.5">{item.detail}</span>
                </div>
                <span className="font-mono text-indigo-400 font-semibold">{item.val}</span>
              </div>
            ))}
          </div>

          <button className="w-full mt-4 py-2 border border-slate-700 rounded-lg text-sm text-slate-300 hover:bg-slate-800 transition">
            View Live Ledger
          </button>
        </div>
      </div>
    </div>
  );
}
