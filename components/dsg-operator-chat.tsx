'use client';

import { useEffect, useRef, useState } from 'react';
import { normalizeAgentChatReply } from '@/lib/dsg/client/agent-chat-normalize';

type Turn = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  pending?: boolean;
};
type Job = { id: string; goal: string; status: string; createdAt?: string; updatedAt?: string };
type ChatReply = { ok?: boolean; data?: { reply?: unknown; fallback?: boolean }; error?: { code?: string; message?: string } };
type JobReply = { ok?: boolean; data?: { id?: string; jobs?: Job[] }; error?: { code?: string; message?: string } };

// A directive starts a persistent job, while questions remain conversation.
// No action is considered executed unless the actual job/provider reports it.
export function isWorkDirective(text: string): boolean {
  const value = text.trim().replace(/^(?:ช่วย|กรุณา|ขอให้|ให้เอเจนต์|เอเจนต์)\s*/, '');
  if (!value || /^(?:ทำไม|อย่างไร|ยังไง|คืออะไร|ได้ไหม|ได้มั้ย|มีไหม|มีมั้ย)/.test(value)) return false;
  if (/\?|？/.test(value) && /(?:ยังไง|อย่างไร|ทำไม|คืออะไร|อะไรบ้าง)/.test(value)) return false;
  return /^(?:สร้าง|แก้ไข|แก้|ปรับปรุง|อัปเดต|อัพเดต|ตรวจสอบ|ทดสอบ|ติดตั้ง|เชื่อมต่อ|เชื่อม|เปิด|รัน|สั่งงาน|ทำงาน|จัดการ|ดีพลอย|deploy|build|พัฒนา|ค้นหา|สรุป|วิเคราะห์|ตรวจ|ทำให้)/i.test(value);
}

const finishedStatuses = new Set(['COMPLETED', 'COMPLETE', 'SUCCESS', 'SUCCEEDED', 'PASSED', 'FAILED', 'CANCELLED', 'CANCELED', 'BLOCKED']);
function displayStatus(status: string): string {
  const code = status.toUpperCase();
  if (['COMPLETED', 'COMPLETE', 'SUCCESS', 'SUCCEEDED', 'PASSED'].includes(code)) return 'เสร็จแล้ว';
  if (code === 'FAILED') return 'ไม่สำเร็จ';
  if (code === 'BLOCKED') return 'ต้องแก้ไขก่อน';
  if (code.includes('APPROV')) return 'รอคุณตัดสินใจ';
  if (['RUNNING', 'EXECUTING', 'IN_PROGRESS', 'PROCESSING'].includes(code)) return 'กำลังทำงาน';
  if (['QUEUED', 'PENDING', 'CREATED', 'DRAFT'].includes(code)) return 'รับงานแล้ว · รอเริ่ม';
  return status || 'ยังไม่มีสถานะ';
}

function apiError(payload: { error?: { code?: string; message?: string } }, fallback: string) {
  return payload.error?.message || payload.error?.code || fallback;
}

export function DsgOperatorChat() {
  const [messages, setMessages] = useState<Turn[]>([]);
  const historyRef = useRef<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsIssue, setJobsIssue] = useState<string | null>(null);
  const [pendingReplies, setPendingReplies] = useState(0);
  const listEnd = useRef<HTMLDivElement>(null);

  function updateMessages(fn: (previous: Turn[]) => Turn[]) {
    const next = fn(historyRef.current);
    historyRef.current = next;
    setMessages(next);
  }

  async function refreshJobs() {
    try {
      const response = await fetch('/api/dsg/jobs', { cache: 'no-store', credentials: 'include' });
      const payload = await response.json() as JobReply;
      if (!response.ok || !payload.ok || !Array.isArray(payload.data?.jobs)) {
        throw new Error(apiError(payload, 'ไม่สามารถอ่านรายการงานได้'));
      }
      setJobs(payload.data.jobs);
      setJobsIssue(null);
    } catch (error) {
      // Never replace real jobs with fabricated data on network failure.
      setJobsIssue(error instanceof Error ? error.message : 'ตรวจรายการงานไม่ได้');
    }
  }

  useEffect(() => {
    void refreshJobs();
    const id = window.setInterval(() => void refreshJobs(), 12000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    listEnd.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [messages]);

  async function createDurableJob(goal: string, replyId: string) {
    try {
      const response = await fetch('/api/dsg/jobs', {
        method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ goal }),
      });
      const payload = await response.json() as JobReply;
      if (response.status !== 201 || !payload.ok || !payload.data?.id) {
        throw new Error(apiError(payload, 'รับงานไม่ได้'));
      }
      await refreshJobs();
      updateMessages(previous => previous.map(item => item.id === replyId
        ? { ...item, text: 'รับงานเข้าระบบแล้ว คุณคุยหรือสั่งงานอื่นต่อได้ ขณะนี้ยังไม่มีหลักฐานว่าเริ่ม Execute งานนี้แล้ว', pending: false }
        : item));
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'ไม่สามารถบันทึกงาน';
      updateMessages(previous => previous.map(item => item.id === replyId
        ? { ...item, text: `ยังรับงานเข้าระบบไม่ได้: ${reason} — ยังไม่มีการสั่ง Execute`, pending: false }
        : item));
    }
  }

  async function answer(message: string, replyId: string, history: { role: string; content: string }[]) {
    try {
      const response = await fetch('/api/dsg/agent-chat', {
        method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message, history, context: { surface: 'dsg-chat-first-workroom' } }),
      });
      const payload = await response.json() as ChatReply;
      if (!response.ok || !payload.ok) throw new Error(apiError(payload, 'แชทไม่พร้อมใช้งาน'));
      const text = normalizeAgentChatReply(payload.data?.reply);
      updateMessages(previous => previous.map(item => item.id === replyId
        ? { ...item, text, pending: false } : item));
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'แชทไม่พร้อมใช้งาน';
      updateMessages(previous => previous.map(item => item.id === replyId
        ? { ...item, text: `ยังตอบไม่ได้: ${reason}`, pending: false } : item));
    } finally {
      setPendingReplies(previous => Math.max(0, previous - 1));
    }
  }

  function send() {
    const value = draft.trim();
    if (!value || value.length > 4000) return;
    const previousHistory = historyRef.current
      .filter(item => !item.pending && item.text)
      .slice(-18)
      .map(item => ({ role: item.role, content: item.text }));
    const userId = crypto.randomUUID();
    const answerId = crypto.randomUUID();
    const jobReplyId = crypto.randomUUID();
    const isTask = isWorkDirective(value);
    updateMessages(previous => [...previous,
      { id: userId, role: 'user', text: value },
      { id: answerId, role: 'assistant', text: 'กำลังตอบ…', pending: true },
      ...(isTask ? [{ id: jobReplyId, role: 'assistant' as const, text: 'กำลังบันทึกงาน…', pending: true }] : []),
    ]);
    setDraft('');
    setPendingReplies(previous => previous + 1);
    // Independent requests: queued work does not block the conversation,
    // and multiple messages may finish in any order.
    void answer(value, answerId, previousHistory);
    if (isTask) void createDurableJob(value, jobReplyId);
  }

  return (
    <section aria-label="แชท DSG ONE" className="flex min-h-[70dvh] flex-col overflow-hidden rounded-3xl border border-slate-700 bg-slate-900">
      <header className="border-b border-slate-800 px-4 py-4 sm:px-6">
        <h1 className="text-xl font-bold text-white">DSG ONE</h1>
        <p className="mt-1 text-sm text-slate-400">บอกสิ่งที่ต้องการได้เลย คุยต่อได้แม้มีงานอื่นค้างอยู่</p>
      </header>
      <div role="log" aria-label="บทสนทนา" aria-live="polite" className="min-h-[40dvh] flex-1 space-y-3 overflow-y-auto px-3 py-5 sm:px-6">
        {messages.length === 0 && <p className="max-w-lg rounded-2xl bg-slate-950 p-4 text-sm text-slate-300">
          สวัสดีครับ ต้องการให้ช่วยอะไร เช่น “ตรวจเว็บไซต์ของฉัน” “แก้หน้าแอปให้ใช้ง่ายขึ้น” หรือถามเรื่องอื่นก็ได้
        </p>}
        {messages.map(item => <article key={item.id} className={`max-w-[95%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[85%] ${
          item.role === 'user' ? 'ml-auto bg-indigo-700 text-white' : 'mr-auto bg-slate-950 text-slate-200'
        }`} aria-busy={item.pending === true}>{item.text}</article>)}
        <div ref={listEnd} />
      </div>
      <div className="border-t border-slate-800 px-3 py-3 sm:px-6">
        <form onSubmit={event => { event.preventDefault(); send(); }} className="flex items-end gap-2">
          <label htmlFor="dsg-chat-message" className="sr-only">ข้อความถึง DSG ONE</label>
          <textarea id="dsg-chat-message" rows={2} maxLength={4000} value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault(); send();
              }
            }}
            className="min-h-12 flex-1 resize-y rounded-2xl border border-slate-600 bg-slate-950 p-3 text-base text-white outline-none focus:border-indigo-400"
            placeholder="พิมพ์สั่งงานหรือคุยกับเอเจนต์…"/>
          <button type="submit" disabled={!draft.trim()}
            className="min-h-12 rounded-2xl bg-indigo-600 px-5 text-sm font-bold text-white disabled:opacity-40">
            ส่ง
          </button>
        </form>
        {pendingReplies > 0 && <p role="status" className="mt-2 text-xs text-slate-400">กำลังตอบ {pendingReplies} ข้อความ · พิมพ์ข้อความถัดไปได้เลย</p>}
      </div>
      <details className="border-t border-slate-800 px-4 py-3 sm:px-6">
        <summary className="cursor-pointer text-sm font-semibold text-slate-300">งานที่รับไว้ ({jobs.length})</summary>
        {jobsIssue && <p role="status" className="mt-2 text-sm text-amber-200">ยังตรวจสถานะงานไม่ได้: {jobsIssue}</p>}
        {jobs.length === 0 && !jobsIssue && <p className="mt-3 text-sm text-slate-400">ยังไม่มีรายการงานใน Workspace นี้</p>}
        <div className="mt-3 space-y-2">
          {jobs.slice(0, 20).map(job => (
            <div key={job.id} className="rounded-xl border border-slate-700 p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="line-clamp-2 text-sm text-white">{job.goal}</p>
                <span className="shrink-0 text-xs text-indigo-200">{displayStatus(job.status)}</span>
              </div>
              <a href={`/dsg/jobs/${encodeURIComponent(job.id)}`} className="mt-2 inline-block text-xs text-sky-300">
                ดูรายละเอียดงาน
              </a>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          สถานะอ้างอิงจากงานที่ Backend บันทึกจริง การรับงานไม่เท่ากับ Execute สำเร็จ
        </p>
      </details>
    </section>
  );
}
