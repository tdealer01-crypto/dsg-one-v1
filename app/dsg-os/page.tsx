import Link from 'next/link';
import {ArrowLeft, ClipboardCheck, Code2, LockKeyhole, ShieldCheck} from 'lucide-react';

export const metadata = {
  title: 'DSG OS · Adapter Builder & Local Evidence Verifier',
  description: 'Author deterministic Spacetime adapter contracts and verify provider evidence in your browser; Spacetime alone grants execution authority.',
};

export default function DSGOSWorkspacePage() {
  return (
    <main className="dsg-page min-h-screen bg-slate-950 px-5 py-10 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-cyan-200 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> DSG ONE home
        </Link>
        <p className="mt-9 text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">DSG OS · Browser workspace</p>
        <h1 className="dsg-page-title mt-3 text-4xl font-black tracking-tight sm:text-5xl">Adapter Builder & Evidence Verifier</h1>
        <p className="mt-5 max-w-3xl text-slate-300">
          Two local tools backed by DSG Spacetime contract source. Author a bounded provider definition
          and verify integrity and signer identity without granting the browser execution authority.
          No token, password or production secret is required.
        </p>
        <div className="mt-9 grid gap-4 sm:grid-cols-2">
          <a href="/dsg-os/adapter-builder/index.html" className="rounded-2xl border border-cyan-600/40 bg-slate-900 p-6 hover:border-cyan-300">
            <Code2 className="h-7 w-7 text-cyan-300" />
            <h2 className="mt-4 text-xl font-bold">Compile Adapter Contract</h2>
            <p className="mt-2 text-sm text-slate-300">Edit provider, capability, schema, risk and scope; compute the route contract hash locally.</p>
            <p className="mt-4 text-xs text-amber-200">Compilation is not registration or authorization.</p>
          </a>
          <a href="/dsg-os/verify/index.html" className="rounded-2xl border border-cyan-600/40 bg-slate-900 p-6 hover:border-cyan-300">
            <ClipboardCheck className="h-7 w-7 text-cyan-300" />
            <h2 className="mt-4 text-xl font-bold">Verify Evidence Locally</h2>
            <p className="mt-2 text-sm text-slate-300">Paste a provider v2 receipt, Ed25519 attestation or Goal-first evidence for independent browser recomputation.</p>
            <p className="mt-4 text-xs text-amber-200">Trust requires a separately pinned public key.</p>
          </a>
        </div>
        <div className="mt-9 rounded-2xl border border-slate-700 bg-slate-900/60 p-6">
          <h2 className="inline-flex items-center gap-2 font-bold"><LockKeyhole className="h-5 w-5 text-cyan-300" /> The execution authority remains in Spacetime</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            Plan → Route/Entitlement → Verified OAuth scope → Policy/Approval → exact payload binding
            → Provider Adapter → provider result → evidence/attestation → next governed action.
            These pages do not register routes, resolve approvals, start a browser, call a provider or
            read production credentials. Success on this page is not proof of Production Browser E2E.
          </p>
          <p className="mt-4 inline-flex gap-2 text-xs text-slate-400"><ShieldCheck className="h-4 w-4" /> Source lineage: DSG Spacetime PR #558. Backend governance enforcement: PR #654.</p>
        </div>
      </div>
    </main>
  );
}
