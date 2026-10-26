'use client';

import { useEffect, useState } from 'react';
import type { AppBuilderJob } from '@/lib/dsg/app-builder/model';

type LoadState = { status: 'loading' | 'ready' | 'blocked'; job: AppBuilderJob | null; error: string };

export function AppBuilderJobDetailClient({ jobId }: { jobId: string }) {
  const [view, setView] = useState<LoadState>({ status: 'loading', job: null, error: '' });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/dsg/app-builder/jobs/${encodeURIComponent(jobId)}`, {
      method: 'GET', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
    }).then(async response => {
      const body: unknown = await response.json();
      if (!response.ok || !body || typeof body !== 'object' || !('ok' in body) || body.ok !== true ||
          !('data' in body) || !body.data || typeof body.data !== 'object') {
        throw new Error(response.status === 401 ? 'LOGIN_REQUIRED' :
          response.status === 404 ? 'JOB_NOT_FOUND_IN_THIS_WORKSPACE' : 'JOB_DETAIL_READ_FAILED');
      }
      const job = body.data as AppBuilderJob;
      if (job.id !== jobId || !job.workspaceId || !job.status || !job.claimStatus) throw new Error('JOB_IDENTITY_MISMATCH');
      if (!controller.signal.aborted) setView({ status: 'ready', job, error: '' });
    }).catch(error => {
      if (!controller.signal.aborted) setView({ status: 'blocked', job: null, error: error instanceof Error ? error.message : 'JOB_DETAIL_READ_FAILED' });
    });
    return () => controller.abort();
  }, [jobId, revision]);

  const job = view.job;
  const verifiedProduction = job?.claimStatus === 'PRODUCTION_VERIFIED';
  return (
    <main className="dsg-page min-h-dvh bg-slate-950 px-4 py-6 text-slate-100 md:px-6 md:py-10">
      <div className="mx-auto max-w-4xl space-y-5">
        <a href="/dsg/app-builder" className="inline-flex min-h-11 items-center rounded-xl border border-slate-700 px-4 text-cyan-200">
          กลับไป App Builder
        </a>
        <section className="rounded-3xl border border-cyan-500/30 bg-slate-900 p-5">
          <p className="text-xs uppercase tracking-widest text-cyan-200">Authenticated Workspace Job · Evidence first</p>
          <h1 className="dsg-page-title mt-3 break-all text-xl font-black sm:text-3xl">Job {jobId}</h1>
          <p role="status" className="mt-3 rounded-xl bg-slate-950 p-3 text-sm">
            {view.status === 'loading' ? 'กำลังอ่าน Job จริงจากฐานข้อมูล…' :
             view.status === 'blocked' ? `BLOCKED · ${view.error}` : `Job status: ${job?.status}`}
          </p>
          <button type="button" onClick={() => { setView({ status: 'loading', job: null, error: '' }); setRevision(value => value + 1); }}
            className="mt-3 min-h-11 rounded-xl border border-cyan-400/40 px-4 text-sm text-cyan-100">
            รีเฟรชข้อมูลจากฐานข้อมูล
          </button>
        </section>
        {job ? (
          <>
            <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
              <h2 className="font-bold">เป้าหมายของงานนี้</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{job.goal?.originalGoal || 'GOAL_UNAVAILABLE'}</p>
              <p className="mt-3 text-sm text-slate-400">สถานะที่บันทึก: {job.status}</p>
              <p className="mt-2 text-sm text-slate-400">ระดับ Claim ที่บันทึก: {job.claimStatus}</p>
              <p className="mt-2 text-xs text-slate-400">Updated: {job.updatedAt}</p>
            </section>
            <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
              <h2 className="font-bold">Plan / Approval Evidence</h2>
              <p className="mt-3 break-all text-xs text-slate-300">Plan Hash: {job.planHash || 'NOT_RECORDED'}</p>
              <p className="mt-2 break-all text-xs text-slate-300">Approval Hash: {job.approvalHash || 'NOT_RECORDED'}</p>
              <p className="mt-2 text-xs text-slate-300">Gate: {job.gateResult?.status || 'NOT_EVALUATED'}</p>
              <p className="mt-2 text-xs text-slate-400">
                สถานะ DB ไม่ใช่หลักฐานว่า Signed Runtime Execute หรือ Deployment ผ่านแล้ว
              </p>
            </section>
            <section className="rounded-2xl border border-amber-400/30 bg-slate-900 p-5">
              <h2 className="font-bold text-amber-200">Live Preview / Deployment</h2>
              <p className="mt-2 text-sm text-slate-300">
                {verifiedProduction
                  ? 'DB claim=PRODUCTION_VERIFIED แต่ยังต้องตรวจ Signed Build/Deploy URL ของ Job นี้จาก Evidence อิสระก่อนเปิด Live Preview'
                  : 'LIVE_PREVIEW_NOT_VERIFIED · ยังไม่มี URL ที่ผูกกับ Job และหลักฐาน Build/Deploy ที่ตรวจแล้ว'}
              </p>
              <p className="mt-2 text-xs text-amber-200">
                ไม่มีการโหลด iframe ตัวอย่างเก่าหรือสร้างลิงก์จาก Job ID โดยการคาดเดา
              </p>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
