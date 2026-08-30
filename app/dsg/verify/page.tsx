'use client';

import { useEffect, useState } from 'react';

type ProofResponse = {
  ok: boolean;
  status?: string;
  proofHash?: string;
  proofKind?: string;
  goal?: string;
  runtimeGate?: {
    status?: string;
    failures?: Array<{ code?: string; message?: string } | string>;
  };
  lifecycle?: {
    delivered?: boolean;
    reason?: string;
  };
  claimBoundary?: {
    claimStatus?: string;
    productionReadyClaim?: boolean;
  };
};

export default function VerifyOneActionPage() {
  const [email, setEmail] = useState('');
  const [goal, setGoal] = useState('Verify an AI agent action before execution and show me why it is allowed or blocked.');
  const [loading, setLoading] = useState(false);
  const [proof, setProof] = useState<ProofResponse | null>(null);
  const [viewRecorded, setViewRecorded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!proof?.proofHash || !email || viewRecorded) return;

    let cancelled = false;
    void fetch('/api/dsg/lifecycle/event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        event: 'proof_viewed',
        email,
        data: {
          proof_hash: proof.proofHash,
          runtime_gate: proof.runtimeGate?.status ?? 'UNKNOWN',
        },
      }),
    })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setViewRecorded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [email, proof, viewRecorded]);

  async function runVerification() {
    setLoading(true);
    setError('');
    setProof(null);
    setViewRecorded(false);

    try {
      await fetch('/api/dsg/lifecycle/event', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          event: 'verification_started',
          email,
          data: { surface: 'dsg_verify_one_action' },
        }),
      });

      const response = await fetch('/api/dsg/app-builder/proof', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ goal, email }),
      });
      const payload = await response.json() as ProofResponse;
      setProof(payload);
      if (!response.ok || !payload.ok) setError('Verification was blocked before a proof could be created.');
    } catch {
      setError('Verification service could not be reached.');
    } finally {
      setLoading(false);
    }
  }

  const failures = proof?.runtimeGate?.failures ?? [];

  return (
    <main className="min-h-screen bg-[#080b10] px-5 py-10 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <p className="font-mono text-xs uppercase tracking-[0.28em] text-cyan-300">DSG First Value</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">Verify one AI action</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
          Describe what you want an AI agent to do. DSG builds the governed flow, evaluates the runtime gate, and returns a proof hash plus the exact next action. A blocked decision is shown as blocked; it is never converted into a success claim.
        </p>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <label className="block text-sm font-semibold text-slate-200">Email for lifecycle receipt</label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-cyan-300/60"
          />

          <label className="mt-5 block text-sm font-semibold text-slate-200">AI action / goal</label>
          <textarea
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            rows={5}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-cyan-300/60"
          />

          <button
            type="button"
            disabled={loading || goal.trim().length < 8 || !email.includes('@')}
            onClick={runVerification}
            className="mt-5 rounded-full bg-cyan-300 px-6 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? 'Verifying…' : 'Verify one AI action'}
          </button>
        </section>

        {error ? <p className="mt-5 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-rose-100">{error}</p> : null}

        {proof?.proofHash ? (
          <section className="mt-8 rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.05] p-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-white/15 px-3 py-1 font-mono text-xs">PROOF CREATED</span>
              <span className="rounded-full border border-white/15 px-3 py-1 font-mono text-xs">Runtime gate: {proof.runtimeGate?.status ?? 'UNKNOWN'}</span>
            </div>

            <h2 className="mt-5 text-2xl font-black">Your verification receipt</h2>
            <dl className="mt-5 space-y-3 text-sm">
              <div><dt className="text-slate-400">Proof hash</dt><dd className="mt-1 break-all font-mono text-cyan-100">{proof.proofHash}</dd></div>
              <div><dt className="text-slate-400">Proof kind</dt><dd className="mt-1 font-mono">{proof.proofKind}</dd></div>
              <div><dt className="text-slate-400">Claim boundary</dt><dd className="mt-1 font-mono">{proof.claimBoundary?.claimStatus}</dd></div>
            </dl>

            {failures.length ? (
              <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-5">
                <h3 className="font-bold text-amber-100">Why execution is blocked / what to fix</h3>
                <ul className="mt-3 space-y-2 text-sm text-amber-50/90">
                  {failures.map((failure, index) => (
                    <li key={index}>• {typeof failure === 'string' ? failure : failure.message ?? failure.code ?? 'Runtime gate requirement not satisfied'}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <p className="mt-6 text-sm text-slate-300">
              {viewRecorded ? 'Proof viewed event recorded for lifecycle routing.' : 'Recording proof_viewed…'}
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}
