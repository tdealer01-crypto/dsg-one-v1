import Link from 'next/link';
import {ArrowLeft, ArrowUpRight, CheckCircle2, ShieldCheck} from 'lucide-react';

const requestEmail = 't.dealer01@dsg.pics';
const requestSubject = 'DSG Fix & Verify — pilot request';
const requestBody = [
  'Project or production URL (public only): ',
  'One problem to investigate: ',
  'How to reproduce or observe it: ',
  'What result would count as success: ',
  'Preferred contact method: ',
  '',
  'Do not include passwords, tokens, private repository contents or personal data in this email.',
].join('\n');

const mailto = `mailto:${requestEmail}?subject=${encodeURIComponent(requestSubject)}&body=${encodeURIComponent(requestBody)}`;

const steps = [
  {
    heading: 'Send one scoped problem',
    description: 'Share a public repository or endpoint, the failure you observe, and the expected outcome. No credentials.',
  },
  {
    heading: 'Agree on what can be inspected or changed',
    description: 'Scope, access and price must be confirmed before any paid work. Private access or production changes require separate authorization.',
  },
  {
    heading: 'Receive the evidence',
    description: 'The deliverable is a bounded fix with actual tests or an evidence-backed remediation report, with PASS / BLOCKED and next action. A fix is not guaranteed.',
  },
];

export default function FixAndVerifyPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-100">
          <ArrowLeft className="h-4 w-4" /> DSG ONE home
        </Link>

        <div className="mt-10 rounded-3xl border border-cyan-500/25 bg-slate-900/75 p-7 sm:p-10">
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-cyan-200">
            <ShieldCheck className="h-4 w-4" /> First-customer pilot · Request only
          </p>
          <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">One blocker. One bounded investigation. Evidence you can review.</h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-slate-300">
            DSG Fix &amp; Verify is a scoped, service-led pilot for teams facing a reproducible application, API, integration or CI problem.
            Instead of selling an unverified autonomous product, we review one real problem and agree on an evidence-based deliverable.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href={mailto} className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-6 py-3.5 text-sm font-black text-slate-950 hover:bg-cyan-200">
              Email one problem <ArrowUpRight className="h-4 w-4" />
            </a>
            <span className="text-xs leading-6 text-slate-400">Opens your email app. No DSG account or OAuth login required.</span>
          </div>
          <p className="mt-4 text-xs text-amber-200/90">
            Payment is not collected on this page. Scope, price and acceptance conditions must be agreed before work begins.
          </p>
        </div>

        <section className="mt-10" aria-labelledby="fix-steps">
          <h2 id="fix-steps" className="text-2xl font-black">How the pilot works</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step.heading} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                <p className="font-mono text-sm font-bold text-cyan-300">0{index + 1}</p>
                <h3 className="mt-4 font-bold text-white">{step.heading}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 p-7" aria-labelledby="pilot-limits">
          <h2 id="pilot-limits" className="text-xl font-black">What you receive — and what is not promised</h2>
          <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-300">
            <li className="flex items-start gap-3"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-300" /> A written, scoped finding with reproducer or supporting evidence wherever available</li>
            <li className="flex items-start gap-3"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-300" /> A reviewed patch / pull request when safe and permitted, or a remediation report with concrete next actions</li>
            <li className="flex items-start gap-3"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-300" /> Clear PASS / BLOCKED / NOT VERIFIED states; test or provider results are not simulated</li>
          </ul>
          <p className="mt-5 border-t border-slate-800 pt-5 text-sm leading-7 text-amber-200/90">
            This pilot does not guarantee resolution, uptime, independent certification, or unattended production deployment.
            We will never ask you to email API keys or passwords. Every privileged change requires explicit scope and approval.
          </p>
        </section>
      </div>
    </main>
  );
}
