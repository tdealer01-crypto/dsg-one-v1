'use client';

import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clipboard, DownloadCloud, FileText, Lock, Share2 } from 'lucide-react';

function goTo(hash: string) {
  window.location.hash = hash;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function EnterpriseProofView() {
  const [copied, setCopied] = useState(false);
  const report = useMemo(() => ({
    product: 'DSG ONE V1',
    purpose: 'Customer handoff report for governed App Builder service',
    safeClaim: 'Customer can create an approved app-builder plan and GitHub PR evidence before spending Vercel quota.',
    notClaimedHere: ['PRODUCTION_VERIFIED', 'live generated-app runtime proof', 'Vercel production deploy from this UI change'],
    userBenefit: [
      'Start from a plain-language app idea',
      'See feature choices before API calls',
      'Approve a visible plan before runtime action',
      'Receive GitHub PR evidence and copy/download proof',
      'Use Vercel only when preview or production proof is actually required',
    ],
    nextSteps: [
      'Use Build app screen',
      'Generate and approve plan',
      'Create PR evidence',
      'Copy proof JSON from the evidence panel',
      'Run preview/production proof only when needed',
    ],
  }), []);

  const reportText = JSON.stringify(report, null, 2);

  async function copyReport() {
    await navigator.clipboard.writeText(reportText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  function downloadReport() {
    const blob = new Blob([reportText], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'dsg-one-customer-handoff-report.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-100">
            ส่งมอบงานให้ลูกค้า
          </h1>
          <p className="mt-1 text-slate-500">คัดลอกหรือดาวน์โหลดรายงาน proof boundary ได้ทันที โดยไม่ trigger Vercel deploy</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => goTo('chat')} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-500">สร้าง proof จากงานจริง</button>
          <button onClick={() => void copyReport()} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-slate-800"><Clipboard className="h-4 w-4" /> {copied ? 'คัดลอกแล้ว' : 'Copy report'}</button>
          <button onClick={downloadReport} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-slate-800"><DownloadCloud className="h-4 w-4" /> Download JSON</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="group relative flex flex-col items-start overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-8">
          <div className="pointer-events-none absolute right-0 top-0 -mr-16 -mt-16 rounded-full bg-indigo-500/5 p-32 blur-3xl" />
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-800">
            <Share2 className="h-6 w-6 text-indigo-400" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-slate-100">Customer Proof Narrative</h2>
          <p className="mb-6 text-sm leading-relaxed text-slate-400">รายงานที่ส่งให้ลูกค้าได้: อธิบายว่าใช้งานอะไรได้จริง, ขอบเขต claim อยู่ตรงไหน, และควรใช้ Vercel quota เมื่อไร.</p>
          <div className="mt-auto w-full space-y-3">
            <div className="flex items-center justify-between rounded border border-slate-800 bg-slate-950 px-4 py-3 text-sm">
              <span className="font-mono text-slate-400">handoff-report.json</span>
              <span className="flex items-center gap-1.5 font-medium text-emerald-400"><CheckCircle2 className="h-4 w-4"/> Ready</span>
            </div>
            <button onClick={() => void copyReport()} className="w-full rounded-lg bg-indigo-600 py-2.5 font-medium text-white shadow-[0_0_15px_rgba(79,70,229,0.3)] transition hover:bg-indigo-500">
              Copy Customer Report
            </button>
          </div>
        </div>

        <div className="relative flex flex-col items-start overflow-hidden rounded-2xl border border-slate-800 bg-[#0b101e] p-8 ring-1 ring-inset ring-indigo-500/20">
          <div className="pointer-events-none absolute right-0 top-0 -mr-16 -mt-16 rounded-full bg-emerald-500/5 p-32 blur-3xl" />
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/10">
            <Lock className="h-6 w-6 text-indigo-400" />
          </div>
          <h2 className="mb-2 flex items-center gap-2 text-xl font-bold text-slate-100">Verified Runtime Evidence</h2>
          <p className="mb-6 text-sm leading-relaxed text-slate-400">ส่วนนี้พาผู้ใช้ไปเก็บหลักฐานจริงก่อน: PR, branch, generated files, auditWritten, แล้วค่อยใช้ preview/production proof เมื่อจำเป็น.</p>
          <div className="mt-auto w-full space-y-3">
            <div className="flex items-center justify-between rounded border border-indigo-500/20 bg-slate-950 px-4 py-3 text-sm">
              <span className="font-mono text-slate-400">PR evidence first</span>
              <span className="flex items-center gap-1.5 font-medium text-indigo-400"><Lock className="h-4 w-4"/> Quota safe</span>
            </div>
            <button onClick={() => goTo('executions')} className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 py-2.5 font-medium text-slate-200 transition hover:bg-slate-700">
              <FileText className="h-4 w-4" /> Open Evidence Map
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="mb-3 font-semibold text-slate-200">รายงานที่ดาวน์โหลดได้</h3>
        <pre className="max-h-80 overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs leading-5 text-slate-400">{reportText}</pre>
      </div>
    </div>
  );
}
