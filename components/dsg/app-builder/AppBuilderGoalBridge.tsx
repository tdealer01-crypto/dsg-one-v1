'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { DsgOutcomeIntake } from '@/lib/dsg/app-builder/outcome-intake';
import { templateGoalDraft, type TemplateGoalDraft } from '@/lib/dsg/client/template-goal-handoff';

export type AcceptedAppOutcome = {
  revision: number;
  goal: string;
  criteria: string[];
  intake: DsgOutcomeIntake;
};

type GoalBridge = {
  templateDraft: TemplateGoalDraft | null;
  submitted: AcceptedAppOutcome | null;
  publish: (acceptedIntake: DsgOutcomeIntake) => void;
};

// This shares only user-entered intent between the outcome intake and the
// console. It does not manufacture a PRD, plan, job or production evidence.
const AppBuilderGoalContext = createContext<GoalBridge | null>(null);

export function AppBuilderGoalProvider({ children, requestedTemplate }: { children: ReactNode; requestedTemplate?: string | string[] }) {
  const [submitted, setSubmitted] = useState<AcceptedAppOutcome | null>(null);
  const [draft, setDraft] = useState<TemplateGoalDraft | null>(null);
  const [loading, setLoading] = useState(requestedTemplate !== undefined);
  const [issue, setIssue] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (requestedTemplate === undefined) return;
    const abort = new AbortController();
    void (async () => {
      try {
        if (typeof requestedTemplate !== 'string' || !/^[a-zA-Z0-9_-]{1,96}$/.test(requestedTemplate)) throw new Error('ลิงก์เทมเพลตไม่ถูกต้อง');
        const response = await fetch('/api/dsg/templates', { credentials: 'include', cache: 'no-store', signal: abort.signal });
        if (!response.ok) throw new Error('ยังอ่านรายการเทมเพลตไม่ได้');
        const selected = templateGoalDraft(await response.json(), requestedTemplate);
        if (!abort.signal.aborted) { setDraft(selected); setIssue(null); }
      } catch (error) {
        if (!abort.signal.aborted) setIssue(error instanceof Error ? error.message : 'อ่านเทมเพลตไม่ได้');
      } finally { if (!abort.signal.aborted) setLoading(false); }
    })();
    return () => abort.abort();
  }, [requestedTemplate, retry]);

  function publish(acceptedIntake: DsgOutcomeIntake) {
    const normalized = acceptedIntake.goal.trim();
    if (!normalized) return;
    // Only consume the normalized response from the server's intake validator,
    // not mutable form state that can change while the POST is pending.
    setSubmitted(prev => ({
      revision: (prev?.revision ?? 0) + 1,
      goal: normalized,
      criteria: acceptedIntake.successOutcome ? [acceptedIntake.successOutcome] : [],
      intake: {
        ...acceptedIntake,
        targetUsers: [...acceptedIntake.targetUsers],
        availableData: [...acceptedIntake.availableData],
        requiredIntegrations: [...acceptedIntake.requiredIntegrations],
      },
    }));
  }

  if (loading || issue) return <main className="dsg-page"><section className="dsg-state-panel">
    <h1 className="dsg-page-title">เปิดเทมเพลตที่เลือก</h1>
    {loading ? <p role="status">กำลังอ่านเทมเพลตและนำเป้าหมายเข้าพื้นที่สร้างแอป…</p> : <>
      <p role="alert">{issue}</p><div className="dsg-action-row">
        <button type="button" onClick={() => { setLoading(true); setIssue(null); setRetry(value => value + 1); }} className="dsg-button-secondary">ลองอ่านอีกครั้ง</button>
        <Link href="/dsg/templates" className="dsg-button-secondary">กลับไปเลือกเทมเพลต</Link>
        <Link href="/dsg/app-builder" className="dsg-text-link">เริ่มจากเป้าหมายของฉัน</Link>
      </div></>}
  </section></main>;

  return (
    <AppBuilderGoalContext.Provider value={{ submitted, publish, templateDraft: draft }}>
      {children}
    </AppBuilderGoalContext.Provider>
  );
}

export function useAppBuilderGoalBridge() {
  return useContext(AppBuilderGoalContext);
}

export function SelectedTemplateNotice() {
  const draft = useAppBuilderGoalBridge()?.templateDraft;
  return draft ? <p role="status" className="mt-4 rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-200">
    เทมเพลตที่เลือก: <strong>{draft.name}</strong> · ปรับเป้าหมายและเงื่อนไขก่อนส่งงานได้
    {draft.descriptionTruncated ? <span className="mt-2 block text-amber-200">คำอธิบายเทมเพลตยาวเกินขีดจำกัดของฟอร์ม ระบบจึงใส่เพียงส่วนต้นให้แก้ไขได้ กรุณาตรวจรายละเอียดและเติมเงื่อนไขสำคัญก่อนสร้างแผน</span> : null}
  </p> : null;
}
