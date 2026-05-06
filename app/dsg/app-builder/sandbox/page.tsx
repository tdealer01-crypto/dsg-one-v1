import Link from 'next/link';
import { SandboxWorkbenchClient } from '@/components/dsg/app-builder/SandboxWorkbenchClient';

export default function SandboxWorkbenchPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-8 shadow-2xl shadow-amber-950/20">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-200">DSG Agent Sandbox</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">Sandbox plan before file writer / PR executor</h1>
          <p className="mt-4 max-w-4xl text-base leading-7 text-slate-300">
            This workbench makes the next agent layer visible before execution: branch name, allowed file paths, allowed commands, secret boundary, truth boundary, audit hash, and next action. It is the bridge between Brain Loop and a real coding-agent runner.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/dsg/app-builder" className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white hover:bg-indigo-500">Back to App Builder</Link>
            <Link href="/api/dsg/app-builder/engines" className="rounded-2xl border border-slate-700 bg-slate-950 px-5 py-3 text-sm font-black text-slate-200">View engine registry</Link>
          </div>
        </section>

        <SandboxWorkbenchClient />
      </div>
    </main>
  );
}
