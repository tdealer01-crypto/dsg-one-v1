import Link from 'next/link';
import {ArrowLeft, ArrowUpRight, ClipboardCheck, LockKeyhole, MonitorPlay, ShieldCheck} from 'lucide-react';

const requestEmail = 't.dealer01@dsg.pics';
const subject = 'DSG Spacetime — governed browser execution pilot';
const details = [
  'Website or web application URL (public landing URL only):',
  'One workflow to automate (describe start and expected result):',
  'Does the workflow require sign-in or changing data? (yes/no):',
  'Which steps need explicit human approval?:',
  'How will you verify the result?:',
  '',
  'Do not email passwords, API keys, cookies, MFA codes, private files or personal data.',
].join('\n');
const requestHref = `mailto:${requestEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(details)}`;

const stages = [
  {heading: 'Describe the browser task', detail: 'Submit one bounded, reproducible website workflow. Public URLs only; never include session secrets in the request.'},
  {heading: 'Review the approved scope', detail: 'DSG Spacetime binds the exact plan and identity; high-risk connect/execute must pass signed user approval.'},
  {heading: 'Run and check evidence', detail: 'Only authorized provider actions are eligible for completion. BLOCKED/FAILED are never relabeled PASS.'},
];

export default function RemoteBrowserExecutionProductPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> DSG ONE home
        </Link>
        <section className="mt-9 rounded-3xl border border-cyan-500/25 bg-slate-900/75 p-7 sm:p-10">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
            <MonitorPlay className="h-4 w-4" /> DSG Spacetime · Browser Execution
          </p>
          <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">
            Governed AI browser execution, with approval before action and proof after.
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-slate-300">
            Delegate a bounded website task. DSG Spacetime is the plan, permission, execution and evidence authority.
            DSG Cinema is the browser executor. DSG ONE V1 provides task orchestration, resumption and next-action planning.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a href={requestHref} className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-6 py-3.5 text-sm font-black text-slate-950 hover:bg-cyan-200">
              Request a supervised pilot <ArrowUpRight className="h-4 w-4" />
            </a>
            <span className="text-sm text-slate-400">No signup or payment required to inquire.</span>
          </div>
          <p className="mt-5 text-sm leading-7 text-amber-200/90">
            Early-access validation only. A configured route is not evidence of a healthy live executor.
            Customer OAuth, approved connect/execute and evidence verification must pass on the production deployment
            before this service can be called ready for unattended customer operation.
          </p>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          {stages.map((stage, index) => (
            <div key={stage.heading} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <p className="text-sm font-black text-cyan-300">0{index + 1}</p>
              <h2 className="mt-4 text-lg font-bold">{stage.heading}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-400">{stage.detail}</p>
            </div>
          ))}
        </section>

        <section className="mt-9 rounded-2xl border border-slate-800 p-7">
          <h2 className="text-2xl font-black">What customers can evaluate</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="flex items-center gap-2 font-bold"><ClipboardCheck className="h-5 w-5 text-cyan-300" /> Workflow control</h3>
              <p className="mt-2 text-sm leading-7 text-slate-400">
                Scoped navigation, inspection, forms and UI steps under a reviewed task plan,
                with explicit handoff for sign-in, consent and other sensitive actions.
              </p>
            </div>
            <div>
              <h3 className="flex items-center gap-2 font-bold"><ShieldCheck className="h-5 w-5 text-cyan-300" /> Verifiable outcome</h3>
              <p className="mt-2 text-sm leading-7 text-slate-400">
                Request and plan binding, provider result, decision state, evidence hash
                and exact next action when an execution is blocked or fails.
              </p>
            </div>
          </div>
          <p className="mt-6 flex items-start gap-3 border-t border-slate-800 pt-5 text-sm leading-7 text-amber-200/90">
            <LockKeyhole className="mt-1 h-5 w-5 shrink-0" />
            This page is a product description and pilot inquiry, not a live browser viewer.
            No browser session, customer authorization or completed task is invented by opening this page.
          </p>
        </section>

        <section className="mt-8 text-sm leading-7 text-slate-400">
          <p>
            The commercial offering is DSG Spacetime governed remote browser execution.
            Pricing, service availability and customer fulfillment remain subject to verified
            production acceptance and an agreed pilot scope.
          </p>
        </section>
      </div>
    </main>
  );
}
