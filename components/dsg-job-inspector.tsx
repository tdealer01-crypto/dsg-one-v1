'use client';

import { useCallback, useEffect, useState } from 'react';
import { safeWorkroomEventSummary, summarizeWorkroomTimeline, type WorkroomTimelineData } from '@/lib/dsg/client/workroom-job-summary';

type TimelineReply = { ok?: boolean; data?: WorkroomTimelineData; error?: { code?: string; message?: string } };

/** Reads the existing workspace-scoped GET /api/dsg/jobs/:jobId; never authorizes execution. */
export function DsgJobInspector({ jobId }: { jobId: string }) {
  const [data, setData] = useState<WorkroomTimelineData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshSerial, setRefreshSerial] = useState(0);
  const refresh = useCallback(() => {
    setLoading(true);
    setData(null);
    setError(null);
    setRefreshSerial(n => n + 1);
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/dsg/jobs/${encodeURIComponent(jobId)}`, {
          credentials: 'include', cache: 'no-store', signal: abort.signal,
        });
        const payload = await response.json() as TimelineReply;
        if (!response.ok || payload.ok !== true || !payload.data?.job) {
          throw new Error(payload.error?.message || payload.error?.code || 'อ่านรายละเอียดงานไม่ได้');
        }
        if (!abort.signal.aborted) setData(payload.data);
      } catch (caught) {
        if (!abort.signal.aborted) setError(caught instanceof Error ? caught.message : 'อ่านรายละเอียดงานไม่ได้');
      } finally {
        if (!abort.signal.aborted) setLoading(false);
      }
    })();
    return () => abort.abort();
  }, [jobId, refreshSerial]);

  const summary = data ? summarizeWorkroomTimeline(data) : null;
  const events = Array.isArray(data?.events) ? data.events.slice(-6).reverse() : [];
  return (
    <section aria-label="ผลและหลักฐานจาก Backend" className="mt-3 rounded-2xl border border-sky-700/60 bg-slate-950 p-4 text-sm text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">ผลและหลักฐานของงาน</h3>
        <button type="button" onClick={refresh} disabled={loading} className="min-h-11 rounded-xl border border-slate-600 px-3 text-sky-200 disabled:opacity-50">รีเฟรชจากเซิร์ฟเวอร์</button>
      </div>
      <p className="mt-1 break-all text-xs text-slate-400">รหัสงาน: {jobId}</p>
      {loading && <p role="status" className="mt-3 text-slate-300">กำลังอ่านข้อมูลจริงจาก Backend…</p>}
      {error && <p role="alert" className="mt-3 text-amber-200">ยังอ่านผลไม่ได้: {error} · ไม่มีการสร้างข้อมูลจำลองทดแทน</p>}
      {summary && <>
        <p className="mt-3 text-sm font-medium">{summary.userMessage}</p>
        <p className="mt-1 text-xs text-slate-400">สถานะในฐานข้อมูล: {summary.status}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="จำนวนรายการหลักฐานจริง">
          <div className="rounded-lg bg-slate-900 p-3">เหตุการณ์ <strong>{summary.events}</strong></div>
          <div className="rounded-lg bg-slate-900 p-3">Evidence Items <strong>{summary.evidenceItems}</strong></div>
          <div className="rounded-lg bg-slate-900 p-3">Manifests <strong>{summary.evidenceManifests}</strong></div>
          <div className="rounded-lg bg-slate-900 p-3">Completion Reports <strong>{summary.completionReports}</strong></div>
        </div>
        <p className="mt-3 rounded-lg border border-amber-700/50 bg-amber-950/30 p-3 text-amber-100">
          <strong>การตรวจหลักฐาน:</strong> ยังไม่ยืนยันลายเซ็นหรือ Provider E2E จากหน้านี้ · พบ Replay Proof {summary.replayProofs} รายการในฐานข้อมูล
        </p>
        <p className="mt-2"><strong>ขั้นต่อไป:</strong> {summary.nextAction}</p>
        {summary.status.includes('APPROV') && <a className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-indigo-700 px-3 font-semibold text-white" href="/dsg/approvals">เปิดคำขออนุมัติ (ตรวจสิทธิ์ก่อน)</a>}
        <details className="mt-4 rounded-lg border border-slate-800 p-3">
          <summary className="cursor-pointer font-semibold">เหตุการณ์ล่าสุดจาก Backend ({summary.events})</summary>
          {events.length ? <ol className="mt-3 list-inside list-decimal space-y-2 text-xs text-slate-300">{events.map((event, index) => <li key={index}>{safeWorkroomEventSummary(event)}</li>)}</ol> : <p className="mt-2 text-xs text-slate-400">ยังไม่มีเหตุการณ์ในฐานข้อมูล</p>}
        </details>
      </>}
    </section>
  );
}
