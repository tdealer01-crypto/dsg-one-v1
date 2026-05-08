'use client';

import { useState } from 'react';
import { Loader2, Play, ShieldCheck } from 'lucide-react';

type RouteResult = {
  intent: string;
  status: string;
  actionLabel: string;
  endpoint?: string;
  method?: string;
  userBenefit: string;
  truthBoundary: string;
  evidence: string[];
};

export function AgentCommandCenter() {
  const [command, setCommand] = useState('Build a customer task tracker with audit evidence');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<RouteResult | null>(null);

  async function routeCommand() {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/dsg/agent-runtime/commands', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ command, userBenefit: 'User gets a concrete governed action instead of a dead button.' }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error?.message || json.error?.code || `HTTP_${res.status}`);
      setResult(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Command routing failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[#C8A24D] bg-[#071326] p-4 text-[#F5F7FA] shadow-[0_0_36px_rgba(200,162,77,0.18)]">
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#E0B95B]">Agent Command Center</p>
      <h2 className="mt-2 text-xl font-black">Command to Governed Action</h2>
      <p className="mt-1 text-sm text-[#D7D9DE]">Type what the agent should do. DSG routes it to an existing service, approval flow, builder request, or safety block.</p>

      <textarea
        value={command}
        onChange={(event) => setCommand(event.target.value)}
        className="mt-4 h-24 w-full rounded-xl border border-[#C8A24D]/50 bg-[#0C2340] p-3 text-sm text-white outline-none"
      />

      <button
        onClick={routeCommand}
        disabled={busy || !command.trim()}
        className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#C8A24D] bg-[#E0B95B] px-4 py-3 text-sm font-black text-[#071326] disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        Route Command
      </button>

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
    </section>
  );
}
