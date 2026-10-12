'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';

type LifecycleResponse = { ok?: boolean; delivery?: { delivered?: boolean } };

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

function FailureList({ failures }: { failures: NonNullable<NonNullable<ProofResponse['runtimeGate']>['failures']> }) {
  return (
    <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-5">
      <h3 className="font-bold text-amber-100">Why execution is blocked / what to fix</h3>
      <ul className="mt-3 space-y-2 text-sm text-amber-50/90">
        {failures.map((failure, index) => (
          <li key={index}>• {typeof failure === 'string' ? failure : failure.message ?? failure.code ?? 'Runtime gate requirement not satisfied'}</li>
        ))}
      </ul>
    </div>
  );
}

export default function VerifyOneActionPage() {
  const [email, setEmail] = useState('');
  const [goal, setGoal] = useState('Verify an AI agent action before execution and show me why it is allowed or blocked.');
  const [loading, setLoading] = useState(false);
  const [proof, setProof] = useState<ProofResponse | null>(null);
  const [viewStatus, setViewStatus] = useState<'idle' | 'pending' | 'recorded' | 'not_recorded'>('idle');
  const [error, setError] = useState('');
  // The address the run was started with: later edits to the input must not re-send events for an old proof.
  const [proofEmail, setProofEmail] = useState('');
  // proof_viewed is attempted once per proof; a failed attempt is not retried in a loop and is not reported as recorded.
  const viewAttempted = useRef<string | null>(null);

  useEffect(() => {
    const hash = proof?.proofHash;
    if (!hash || !proofEmail || viewAttempted.current === hash) return;
    viewAttempted.current = hash;
    setViewStatus('pending');

    void fetch('/api/dsg/lifecycle/event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        event: 'proof_viewed',
        email: proofEmail,
        data: {
          proof_hash: hash,
          runtime_gate: proof.runtimeGate?.status ?? 'UNKNOWN',
        },
      }),
    })
      .then(async (response) => (response.ok ? await response.json() as LifecycleResponse : null))
      .catch(() => null)
      .then((result) => {
        if (viewAttempted.current === hash) setViewStatus(result?.delivery?.delivered === true ? 'recorded' : 'not_recorded');
      });
  }, [proof, proofEmail]);

  async function runVerification() {
    setLoading(true);
    setError('');
    setProof(null);
    setViewStatus('idle');
    setProofEmail(email);
    viewAttempted.current = null;

    // Telemetry only: the lifecycle receipt must never block or fail the verification itself.
    void fetch('/api/dsg/lifecycle/event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        event: 'verification_started',
        email,
        data: { surface: 'dsg_verify_one_action' },
      }),
    }).catch(() => null);

    try {
      const response = await fetch('/api/dsg/app-builder/proof', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ goal, email }),
      });
      const payload = await response.json() as ProofResponse;
      setProof(payload);
      if (!response.ok || !payload.ok) {
        setError(payload.proofHash
          ? 'Verification was blocked: a proof was recorded, but execution is not allowed. See the reasons below.'
          : 'Verification was blocked before a proof could be created. See the reasons below, fix them, and run it again.');
      }
    } catch {
      setError('Verification service could not be reached. Check your connection and press the button again.');
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!loading && goal.trim().length >= 8 && email.includes('@')) void runVerification();
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

        <form onSubmit={onSubmit} className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6" noValidate>
          <label htmlFor="verify-email" className="block text-sm font-semibold text-slate-200">Email for lifecycle receipt</label>
          <input
            id="verify-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            aria-describedby="verify-email-help"
            className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-cyan-300/60"
          />
          <p id="verify-email-help" className="mt-2 text-xs leading-5 text-slate-400">
            The verification itself does not need this. A lifecycle receipt is only recorded when this is the email of the account you are signed in with.
          </p>

          <label htmlFor="verify-goal" className="mt-5 block text-sm font-semibold text-slate-200">AI action / goal</label>
          <textarea
            id="verify-goal"
            name="goal"
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            rows={5}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-cyan-300/60"
          />

          <button
            type="submit"
            disabled={loading || goal.trim().length < 8 || !email.includes('@')}
            className="mt-5 min-h-11 rounded-full bg-cyan-300 px-6 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? 'Verifying…' : 'Verify one AI action'}
          </button>
          {goal.trim().length < 8 || !email.includes('@') ? (
            <p className="mt-2 text-xs text-slate-400">Enter an email address and a goal of at least 8 characters to enable the button.</p>
          ) : null}
        </form>

        {error ? <p role="alert" className="mt-5 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-rose-100">{error}</p> : null}

        {!proof?.proofHash && failures.length ? <FailureList failures={failures} /> : null}

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

            {failures.length ? <FailureList failures={failures} /> : null}

            <p role="status" className="mt-6 text-sm text-slate-300">
              {viewStatus === 'recorded' ? 'Proof viewed event recorded for lifecycle routing.'
                : viewStatus === 'not_recorded' ? 'The lifecycle receipt was not delivered. The proof above is unaffected.'
                : 'Recording proof_viewed…'}
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}
