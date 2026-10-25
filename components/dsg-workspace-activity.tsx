'use client';

import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { DsgJobInspector } from '@/components/dsg-job-inspector';
import { activityCategory, activityStatus, readWorkspaceJobs, type WorkspaceActivityJob } from '@/lib/dsg/client/workspace-activity';

const views = {
  history: { title: 'ประวัติงานและผลลัพธ์', description: 'ค้นหางานที่บันทึกไว้ แล้วเปิดดูผล เหตุการณ์ และหลักฐานของงานนั้น' },
  analytics: { title: 'การใช้งานพื้นที่ทำงาน', description: 'ภาพรวมจากรายการงานที่บัญชีนี้มีสิทธิ์อ่าน ตัวเลขนี้ไม่ยืนยันผลการทำงานของ Provider' },
  attention: { title: 'งานที่ต้องติดตาม', description: 'งานที่รอการตัดสินใจหรือต้องตรวจสาเหตุ จากสถานะล่าสุดที่อ่านได้' },
};

export function DsgWorkspaceActivity({ view }: { view: keyof typeof views }) {
  const [jobs, setJobs] = useState<WorkspaceActivityJob[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [serial, setSerial] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const instance = useId();
  const copy = views[view];

  useEffect(() => {
    const abort = new AbortController();
    void (async () => {
      try {
        const response = await fetch('/api/dsg/jobs', { credentials: 'include', cache: 'no-store', signal: abort.signal });
        if (response.status === 401) {
          if (!abort.signal.aborted) setNeedsSignIn(true);
          throw new Error('เซสชันเว็บไซต์หมดอายุ เปิดพื้นที่ทำงานเพื่อยืนยันบัญชีและกลับมาดูรายการนี้');
        }
        if (!response.ok) throw new Error('ยังอ่านรายการงานไม่ได้ กรุณาลองโหลดใหม่หรือตรวจพื้นที่ทำงานที่เลือก');
        const records = readWorkspaceJobs(await response.json());
        if (!abort.signal.aborted) {
          setJobs(records); setError(null); setNeedsSignIn(false); setUpdatedAt(new Date().toISOString());
        }
      } catch (caught) {
        if (!abort.signal.aborted) setError(caught instanceof Error ? caught.message : 'อ่านรายการงานไม่ได้');
      } finally { if (!abort.signal.aborted) setLoading(false); }
    })();
    return () => abort.abort();
  }, [serial]);

  function refresh() { setLoading(true); setError(null); setSerial(value => value + 1); }
  const records = (jobs || []).filter(job =>
    (view !== 'attention' || activityCategory(job) === 'attention') &&
    (filter === 'all' || activityCategory(job) === filter) &&
    (!query.trim() || (job.goal + ' ' + job.id).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));
  const pages = Math.max(1, Math.ceil(records.length / 10));
  const currentPage = Math.min(page, pages);
  const visible = records.slice((currentPage - 1) * 10, currentPage * 10);

  return <section aria-label={copy.title} className="mx-auto max-w-6xl space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0"><h1 className="dsg-page-title">{copy.title}</h1><p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">{copy.description}</p></div>
      <button type="button" onClick={refresh} disabled={loading} className="dsg-button-secondary">{loading ? 'กำลังโหลด…' : 'รีเฟรชรายการ'}</button>
    </header>
    {loading && <p role="status" className="text-sm text-slate-300">กำลังอ่านรายการงานจากเซิร์ฟเวอร์…</p>}
    {error && <div role="alert" className="rounded-xl border border-amber-600 bg-amber-950/30 p-4 text-sm text-amber-100">
      <p>{error}</p>{jobs && <p className="mt-1">รายการด้านล่างเป็นข้อมูลที่อ่านได้ครั้งก่อน</p>}
      <div className="dsg-action-row">{needsSignIn
        ? <Link href="/dsg/workroom" className="dsg-button-secondary">เปิดพื้นที่ทำงาน</Link>
        : <button type="button" onClick={refresh} disabled={loading} className="dsg-button-secondary">ลองโหลดใหม่</button>}
        <Link href="/dsg/access" className="dsg-text-link">ตรวจบัญชีและพื้นที่ทำงาน</Link></div>
    </div>}
    {jobs && <>
      {view === 'analytics' && <>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="จำนวนงานที่อ่านได้">
          {[
            ['งานที่บันทึก', jobs.length], ['กำลังทำงาน', jobs.filter(job => activityCategory(job) === 'running').length],
            ['ต้องติดตาม', jobs.filter(job => activityCategory(job) === 'attention').length], ['มีรายงานผล', jobs.filter(job => !!job.completionReportId).length],
          ].map(([label, count]) => <div key={label} className="rounded-xl border border-slate-700 bg-slate-900 p-4"><dt className="text-sm text-slate-300">{label}</dt><dd className="mt-2 text-2xl font-semibold text-white">{count}</dd></div>)}
        </dl>
        <p className="text-sm text-slate-400">ยังไม่มีข้อมูล Token และค่าใช้จ่ายที่ตรวจสอบได้จากรายการนี้</p>
      </>}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="text-sm font-medium text-slate-300" htmlFor={instance + '-search'}>ค้นหางาน
          <input id={instance + '-search'} type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }}
            placeholder="ชื่อหรือรหัสงาน" className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100" /></label>
        <label className="text-sm font-medium text-slate-300" htmlFor={instance + '-filter'}>สถานะ
          <select id={instance + '-filter'} value={filter} onChange={event => { setFilter(event.target.value); setPage(1); }}
            className="mt-2 block w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100">
            <option value="all">ทั้งหมด</option><option value="attention">ต้องติดตาม</option><option value="running">กำลังทำงาน</option>
            <option value="reported">มีรายงานผล</option><option value="pending">สถานะอื่น</option>
          </select></label>
      </div>
      {!loading && <p role="status" className="text-sm text-slate-400">พบ {records.length} งาน{updatedAt && <> · อ่านล่าสุด <time dateTime={updatedAt}>{new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }).format(new Date(updatedAt))}</time> น.</>}</p>}
      {records.length === 0 ? <div className="rounded-xl border border-dashed border-slate-600 p-6 text-center">
        <h2 className="font-semibold text-white">{query || filter !== 'all' ? 'ไม่พบงานที่ตรงกับตัวกรอง' : view === 'attention' ? 'ยังไม่พบงานที่ต้องติดตาม' : 'ยังไม่มีงานในพื้นที่นี้'}</h2>
        <p className="mt-2 text-sm text-slate-300">{query || filter !== 'all' ? 'เปลี่ยนคำค้นหาหรือล้างตัวกรองเพื่อดูรายการทั้งหมด' : 'เริ่มจากบอกสิ่งที่ต้องการในพื้นที่ทำงาน แล้วกลับมาติดตามผลที่นี่ได้'}</p>
        {query || filter !== 'all' ? <button type="button" onClick={() => { setQuery(''); setFilter('all'); setPage(1); }} className="dsg-button-secondary mt-4">ล้างตัวกรอง</button>
          : <Link href="/dsg/workroom" className="dsg-button-primary mt-4">เปิดพื้นที่ทำงาน</Link>}
      </div> : <ul className="space-y-3">{visible.map(job => <li key={job.id} className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1 basis-48">
          <h2 className="break-words text-base font-semibold text-white">{job.goal || 'งานที่ยังไม่มีชื่อ'}</h2>
          <p className="mt-1 text-sm text-slate-300">{activityStatus(job)}</p>
          <p className="mt-2 break-all text-xs text-slate-400">รหัสงาน: {job.id}</p>
        </div><button type="button" aria-expanded={selected === job.id} aria-controls={instance + '-' + job.id}
          onClick={() => setSelected(selected === job.id ? null : job.id)} className="dsg-button-secondary">{selected === job.id ? 'ซ่อนรายละเอียด' : 'ดูผลและหลักฐาน'}</button></div>
        <div id={instance + '-' + job.id}>{selected === job.id && <DsgJobInspector jobId={job.id} />}</div>
      </li>)}</ul>}
      {pages > 1 && <nav aria-label="หน้ารายการงาน" className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="dsg-button-secondary">ก่อนหน้า</button>
        <p className="text-sm text-slate-300">หน้า {currentPage} จาก {pages}</p>
        <button type="button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)} className="dsg-button-secondary">ถัดไป</button>
      </nav>}
    </>}
  </section>;
}
