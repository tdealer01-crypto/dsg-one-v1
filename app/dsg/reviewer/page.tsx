'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type Preflight = {
  status: 'PREFLIGHT_ELIGIBLE' | 'BLOCKED';
  reason: string;
  next?: string;
  executionEnabled?: false;
  productionAccessGranted?: false;
  resourceIsolationE2E?: 'NOT_VERIFIED';
  chatgptOAuthSessionE2E?: 'NOT_VERIFIED';
};

const explanation: Record<string, { th: string; en: string }> = {
  DSG_SIGN_IN_REQUIRED: { th: 'กรุณาเข้าสู่ระบบ DSG ONE ก่อน', en: 'Sign in to DSG ONE first' },
  WORKSPACE_SELECTION_REQUIRED: { th: 'เลือกพื้นที่ทำงานของคุณก่อน', en: 'Select your workspace first' },
  DSG_IDENTITY_NOT_VERIFIED: { th: 'เซสชัน DSG ไม่ได้รับการยืนยัน', en: 'Your DSG session could not be verified' },
  VERIFIED_REVIEWER_REQUIRED: { th: 'ต้องยืนยันอีเมลด้วยบัญชี DSG จริง', en: 'A real, email-verified DSG identity is required' },
  REVIEWER_VERIFIED_IDENTITY_REQUIRED: { th: 'ต้องยืนยันตัวตนและอีเมลก่อน', en: 'A verified identity and email are required' },
  REVIEWER_WORKSPACE_MEMBERSHIP_REQUIRED: { th: 'ยังไม่มีสิทธิ์ AUDITOR ในพื้นที่ Reviewer ที่เลือก', en: 'AUDITOR membership is missing in this reviewer workspace' },
  REVIEWER_INVITE_REQUIRED: { th: 'ยังไม่มีคำเชิญ ChatGPT Reviewer ที่ถูกต้องและไม่หมดอายุ', en: 'An active, unexpired ChatGPT Reviewer invitation is missing' },
  REVIEWER_AUTH0_ACCOUNT_LINK_REQUIRED: { th: 'ยังไม่ยืนยันการเชื่อม Auth0 กับบัญชี DSG', en: 'Auth0 and DSG account linkage has not been verified' },
  REVIEWER_SANDBOX_WORKSPACE_MISSING: { th: 'ยังไม่มี Reviewer Workspace ที่ตรงกับบัญชี', en: 'Reviewer workspace is unavailable' },
  REVIEWER_SANDBOX_NOT_DECLARED: { th: 'พื้นที่นี้ยังไม่ได้ระบุว่าเป็น Reviewer Sandbox', en: 'The selected workspace is not a declared reviewer sandbox' },
  REVIEWER_PREFLIGHT_BACKEND_UNAVAILABLE: { th: 'Backend ตรวจสิทธิ์ยังไม่พร้อมหรือผูกฐานข้อมูลไม่ถูกต้อง', en: 'Reviewer backend or database binding is unavailable' },
  IDENTITY_AND_INVITE_CHECKS_PASSED_EXECUTION_NOT_GRANTED: { th: 'ตัวตนและคำเชิญผ่าน แต่ยังไม่อนุญาตให้ใช้เครื่อง', en: 'Identity and invitation passed, but device access is not granted' },
};

export default function DsgReviewerAccessPage() {
  const [lang, setLang] = useState<'th' | 'en'>('th');
  const [data, setData] = useState<Preflight | null>(null);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/dsg/reviewer/preflight', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const payload = await response.json() as Preflight;
      setData(payload);
    } catch {
      setData({ status: 'BLOCKED', reason: 'REVIEWER_PREFLIGHT_BACKEND_UNAVAILABLE' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/api/dsg/reviewer/preflight', {
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then(response => response.json() as Promise<Preflight>)
      .then(payload => { if (active) setData(payload); })
      .catch(() => {
        if (active) setData({
          status: 'BLOCKED', reason: 'REVIEWER_PREFLIGHT_BACKEND_UNAVAILABLE',
        });
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const eligible = data?.status === 'PREFLIGHT_ELIGIBLE';
  const reason = data?.reason || 'REVIEWER_PREFLIGHT_BACKEND_UNAVAILABLE';
  const title = lang === 'th' ? 'DSG ONE — ตรวจสิทธิ์ Reviewer' : 'DSG ONE — Reviewer Access';
  const statusText = loading
    ? (lang === 'th' ? 'กำลังตรวจสิทธิ์จริง...' : 'Checking real access...')
    : eligible
      ? (lang === 'th' ? 'ผ่านเงื่อนไขเบื้องต้น' : 'Preflight eligible')
      : (lang === 'th' ? 'ยังไม่ผ่าน — ต้องแก้' : 'Blocked — action needed');

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex items-center justify-between gap-3">
          <Link href="/dsg/access" className="text-sm font-semibold text-cyan-300 underline">
            DSG ONE Access Hub
          </Link>
          <div role="group" aria-label="Language" className="flex gap-2">
            <button type="button" onClick={() => setLang('th')} aria-pressed={lang === 'th'}
              className="rounded-lg border border-slate-700 px-3 py-2">TH</button>
            <button type="button" onClick={() => setLang('en')} aria-pressed={lang === 'en'}
              className="rounded-lg border border-slate-700 px-3 py-2">EN</button>
          </div>
        </header>
        <h1 className="text-3xl font-black">{title}</h1>
        <p className="text-sm leading-7 text-slate-300">
          {lang === 'th'
            ? 'ใช้บัญชี DSG ONE ของผู้ทดสอบจริงและ Workspace เฉพาะ Reviewer ไม่ใช้สิทธิ์ Owner'
            : 'Use the real reviewer DSG account and its own workspace, not the Owner identity.'}
        </p>
        <section aria-live="polite" className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5">
          <h2 className="text-lg font-bold">{statusText}</h2>
          {!loading && <p className="text-sm leading-7">
            {explanation[reason]?.[lang] || reason}
          </p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-800 p-3">
              <div className="text-xs text-slate-300">Reviewer identity / invitation</div>
              <strong>{eligible ? 'PREFLIGHT_ELIGIBLE' : 'BLOCKED'}</strong>
            </div>
            <div className="rounded-xl bg-slate-800 p-3">
              <div className="text-xs text-slate-300">Native / Cinema execution</div>
              <strong>LOCKED</strong>
            </div>
            <div className="rounded-xl bg-slate-800 p-3">
              <div className="text-xs text-slate-300">Sandbox isolation E2E</div>
              <strong>NOT_VERIFIED</strong>
            </div>
            <div className="rounded-xl bg-slate-800 p-3">
              <div className="text-xs text-slate-300">ChatGPT OAuth E2E</div>
              <strong>NOT_VERIFIED</strong>
            </div>
          </div>
          <button type="button" onClick={() => void check()} disabled={loading}
            className="w-full rounded-xl bg-cyan-300 px-5 py-3 font-bold text-slate-950 disabled:opacity-50">
            {lang === 'th' ? 'ตรวจสิทธิ์อีกครั้ง' : 'Recheck access'}
          </button>
        </section>
        <p className="text-xs leading-6 text-amber-200">
          {lang === 'th'
            ? 'การผ่าน Preflight ไม่ใช่สิทธิ์สั่งเครื่องหรือการอนุมัติ Production ต้องผ่านการทดสอบแยกผู้ใช้จริงและ DSG Approval Gate ก่อน'
            : 'Passing preflight is not execution authorization. Real two-user isolation and governed approval are required before sandbox execution.'}
        </p>
        <div className="flex flex-wrap gap-5 text-sm">
          <Link href="/login?next=/dsg/reviewer" className="text-cyan-300 underline">
            {lang === 'th' ? 'เข้าสู่ระบบ DSG ONE' : 'DSG ONE sign in'}
          </Link>
          <Link href="/try" className="text-cyan-300 underline">
            {lang === 'th' ? 'ขอทดลอง Pilot' : 'Request pilot'}
          </Link>
        </div>
      </div>
    </main>
  );
}
