'use client';

import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  LayoutTemplate,
  LogIn,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

const steps = [
  {
    number: '01',
    title: 'Describe one AI action',
    desc: 'State the outcome you want in plain language.',
  },
  {
    number: '02',
    title: 'DSG evaluates the governed path',
    desc: 'The plan and runtime gate are evaluated without turning a blocked state into success.',
  },
  {
    number: '03',
    title: 'Receive a proof receipt',
    desc: 'See the proof hash, decision state, blocked reasons, and next safe action.',
  },
];

const publicPrinciples = [
  'Evidence before execution',
  'Blocked states stay blocked',
  'Runtime credentials stay server-side',
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-white">
            <Sparkles className="h-4 w-4 text-cyan-300" />
            DSG ONE
          </Link>

          <nav className="hidden items-center gap-2 md:flex">
            <a href="#how-it-works" className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-white">
              How it works
            </a>
            <a href="#truth-boundary" className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-white">
              Truth boundary
            </a>
            <Link href="/login?next=/dsg/access" className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold text-slate-200 hover:border-cyan-300/50 hover:text-white">
              <LogIn className="h-4 w-4" />
              Sign in
            </Link>
          </nav>

          <Link href="/login?next=/dsg/access" className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200 md:hidden">
            <LogIn className="h-4 w-4" />
            Sign in
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950/30 to-slate-950 px-5 py-24 text-center sm:px-8 sm:py-32">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(34,211,238,0.12),transparent_42%)]" />
        <div className="relative mx-auto max-w-5xl">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            Public DSG ONE landing
          </div>
          <h1 className="mt-7 text-5xl font-black tracking-tight sm:text-7xl">
            Verify before
            <br className="hidden sm:block" /> AI executes.
          </h1>
          <p className="mx-auto mt-7 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
            DSG ONE helps teams evaluate an AI action through a governed path and see the evidence behind the decision before execution is allowed.
          </p>
          <p className="mt-4 font-mono text-sm tracking-[0.18em] text-cyan-300/80">
            Action → Gate → Decision → Proof
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/login?next=/dsg/access" className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-6 py-3.5 text-sm font-black text-slate-950 hover:bg-cyan-200">
              Enter DSG ONE
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login?next=/dsg/verify" className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/60 px-6 py-3.5 text-sm font-bold text-slate-200 hover:border-cyan-300/50 hover:bg-slate-800">
              Verify one AI action
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <p className="mt-6 text-xs text-slate-500">
            The public page is viewable without an account. Product actions require protected access.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-20 px-5 py-16 sm:px-8">
        <section id="how-it-works" className="scroll-mt-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-cyan-300">First value</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">A clear decision path for every action</h2>
          </div>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {steps.map((step) => (
              <article key={step.number} className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-2xl font-black text-slate-600">{step.number}</span>
                  <span className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-2 text-cyan-200">
                    {step.number === '03' ? <CheckCircle2 className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-black">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">{step.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-7">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-indigo-300">Designed for governed work</p>
            <h2 className="mt-3 text-2xl font-black">Make the result understandable before it becomes an action.</h2>
            <div className="mt-6 space-y-3">
              {publicPrinciples.map((principle) => (
                <div key={principle} className="flex items-center gap-3 text-sm text-slate-300">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                  {principle}
                </div>
              ))}
            </div>
          </div>
          <div id="truth-boundary" className="scroll-mt-24 rounded-3xl border border-amber-400/20 bg-amber-400/[0.06] p-7">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-amber-200">Truth boundary</p>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              A proof receipt shows that a governed flow was evaluated. It does not claim production readiness, deployment, certification, or marketplace approval unless separate evidence proves those states.
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-gradient-to-r from-indigo-950/50 to-slate-900 p-7 sm:p-9">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-cyan-300">Next step</p>
              <h2 className="mt-3 text-2xl font-black">Enter the protected DSG workspace.</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">Sign in once, then choose the governed workspace and open Verify, Build, Workroom, or the available runtime surfaces.</p>
            </div>
            <Link href="/login?next=/dsg/access" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-indigo-500 px-5 py-3 text-sm font-black text-white hover:bg-indigo-400">
              Open Access
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 pt-8 text-sm text-slate-500">
          <span>DSG ONE · Evidence-first AI governance</span>
          <Link href="/login?next=/dsg/access" className="inline-flex items-center gap-2 font-bold text-indigo-300 hover:text-indigo-200">
            Protected product access
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </section>
      </div>
    </main>
  );
}
