'use client';

import React from 'react';
import { FileText, CheckCircle2, Lock, Share2, DownloadCloud } from 'lucide-react';

export function EnterpriseProofView() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 items-center flex gap-2">
            Enterprise Proof Surfaces
          </h1>
          <p className="text-slate-500 mt-1">Audit-ready verification reports for both public and org-scoped evaluation.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        
        {/* Public Narrative */}
        <div className="border border-slate-800 rounded-2xl bg-slate-900 p-8 flex flex-col items-start relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-32 bg-indigo-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
          
          <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-6">
            <Share2 className="w-6 h-6 text-indigo-400" />
          </div>
          
          <h2 className="text-xl font-bold text-slate-100 mb-2">Public Proof Narrative</h2>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            AI-readable narrative designed for customers, partners, and public evaluation. Safe to share externally and does not leak runtime secrets.
          </p>
          
          <div className="mt-auto space-y-3 w-full">
            <div className="bg-slate-950 px-4 py-3 rounded border border-slate-800 flex justify-between items-center text-sm">
              <span className="font-mono text-slate-400">/enterprise-proof/report</span>
              <span className="text-emerald-400 font-medium flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4"/> Public</span>
            </div>
            <button className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition shadow-[0_0_15px_rgba(79,70,229,0.3)]">
              Generate Public Proof
            </button>
          </div>
        </div>

        {/* Verified Proof */}
        <div className="border border-slate-800 rounded-2xl bg-[#0b101e] p-8 flex flex-col items-start relative overflow-hidden ring-1 ring-inset ring-indigo-500/20">
          <div className="absolute top-0 right-0 p-32 bg-emerald-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
          
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mb-6">
            <Lock className="w-6 h-6 text-indigo-400" />
          </div>
          
          <h2 className="text-xl font-bold text-slate-100 mb-2 flex items-center gap-2">
            Verified Runtime Evidence
          </h2>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            Org-scoped, authenticated evidence layer. Backed by real runtime execution logs, tampering checks, and complete policy decision traces.
          </p>
          
          <div className="mt-auto space-y-3 w-full">
            <div className="bg-slate-950 px-4 py-3 rounded border border-indigo-500/20 flex justify-between items-center text-sm">
              <span className="font-mono text-slate-400">/enterprise-proof/verified</span>
              <span className="text-indigo-400 font-medium flex items-center gap-1.5"><Lock className="w-4 h-4"/> Auth Required</span>
            </div>
            <button className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-medium transition flex items-center justify-center gap-2">
              <DownloadCloud className="w-4 h-4" /> Download Runtime Audit
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
