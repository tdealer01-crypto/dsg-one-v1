'use client';

import Link from 'next/link';
import {
  Sparkles,
  LayoutTemplate,
  Bell,
  ArrowRight,
  CheckCircle2,
  Cpu,
  ShieldCheck,
} from 'lucide-react';

const templates = [
  { label: 'SaaS Starter', slug: 'saas-starter' },
  { label: 'AI Chatbot', slug: 'ai-chatbot' },
  { label: 'Analytics Dashboard', slug: 'analytics' },
  { label: 'More →', slug: 'more' },
];

const steps = [
  {
    number: '01',
    title: 'Describe one AI action',
    desc: 'State the outcome you want in plain language.',
    iconType: 'sparkles',
  },
  {
    number: '02',
    title: 'DSG verifies the governed path',
    desc: 'The plan and runtime gate are evaluated without converting a blocked state into success.',
    iconType: 'shield',
  },
  {
    number: '03',
    title: 'See the proof receipt',
    desc: 'Get the proof hash, current decision state, blocked reasons, and the next safe action.',
    iconType: 'check',
  },
];

const navLinks = [
  { label: 'Verify', href: '/dsg/verify' },
  { label: 'Build', href: '/dsg/app-builder' },
  { label: 'Templates', href: '/dsg/templates' },
  { label: 'Analytics', href: '/dsg/analytics' },
  { label: 'History', href: '/dsg/history' },
];

function StepIcon({ type }: { type: string }) {
  if (type === 'sparkles') return <Sparkles className="h-5 w-5 text-indigo-300" />;
  if (type === 'shield') return <ShieldCheck className="h-5 w-5 text-cyan-300" />;
  if (type === 'cpu') return <Cpu className="h-5 w-5 text-indigo-300" />;
  return <CheckCircle2 className="h-5 w-5 text-emerald-400" />;
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-800 bg-slate-950/90 px-6 backdrop-blur-md">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-white"
        >
          <Sparkles className="h-4 w-4 text-indigo-400" />
          DSG ONE V1
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl px-3 py-1.5 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/dsg/notifications"
          className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
        >
          <Bell className="h-5 w-5" />
        </Link>
      </header>

      <section className="flex min-h-[60vh] flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950/20 to-slate-950 px-6 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
          <ShieldCheck className="h-3.5 w-3.5" /> Evidence-first AI governance
        </div>
        <h1 className="text-5xl font-black tracking-tight md:text-7xl">
          Verify before
          <br className="hidden md:block" /> AI executes.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-400">
          Give DSG one AI action. See the governed decision, proof hash, blocked reasons, and next safe action without trusting a black-box success claim.
        </p>
        <p className="mt-3 font-mono text-sm tracking-widest text-cyan-300/70">
          Action → Gate → Decision → Proof
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dsg/verify"
            className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-6 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-200"
          >
            Verify one AI action <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/dsg/app-builder"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 px-6 py-3 text-sm font-bold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          >
            Start App Builder
          </Link>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-16 px-6 py-16">
        <section>
          <h2 className="mb-8 text-center text-2xl font-black">First value in one flow</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.number} className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
                <div className="mb-4 flex items-center gap-3">
                  <span className="font-mono text-2xl font-black text-slate-700">{step.number}</span>
                  <span className="rounded-xl border border-slate-800 bg-slate-950 p-2">
                    <StepIcon type={step.iconType} />
                  </span>
                </div>
                <h3 className="mb-2 text-base font-bold">{step.title}</h3>
                <p className="text-sm leading-6 text-slate-400">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="rounded-3xl border border-amber-400/20 bg-amber-400/[0.05] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-200">Truth boundary</p>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
              A proof receipt can show that the governed flow was evaluated even when execution is blocked. It does not claim production readiness, deployment, certification, or external marketplace approval unless separate evidence proves those states.
            </p>
          </div>
        </section>

        <section>
          <h2 className="mb-6 text-xl font-black">Continue into App Builder</h2>
          <div className="flex flex-wrap gap-3">
            {templates.map((template) => (
              <Link
                key={template.slug}
                href={`/dsg/app-builder?template=${template.slug}`}
                className="rounded-2xl border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-bold text-slate-300 transition-colors hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:text-indigo-200"
              >
                <LayoutTemplate className="mr-2 inline h-4 w-4" />
                {template.label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
