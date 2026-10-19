'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, Loader2, MessageSquare, RefreshCw } from 'lucide-react';
import { normalizeAgentChatReply } from '@/lib/dsg/client/agent-chat-normalize';

type Turn = { id: string; role: 'user' | 'assistant'; text: string; pending?: boolean };
type RuntimeJob = {
  id: string; goal: string; status: string;
  completionReportId?: string | null; updatedAt?: string;
};
type ChatPayload = { ok?: boolean; data?: { reply?: unknown; fallback?: boolean }; error?: { code?: string; message?: string } };
type JobsPayload = { ok?: boolean; data?: { id?: string; jobs?: RuntimeJob[] }; error?: { code?: string; message?: string } };

const COMPLETED = new Set(['COMPLETED', 'COMPLETE', 'SUCCEEDED', 'SUCCESS']);
const FAILED = new Set(['FAILED', 'CANCELLED', 'BLOCKED', 'REJECTED']);
const WAITING = new Set(['PENDING_APPROVAL', 'APPROVAL_REQUIRED', 'AWAITING_APPROVAL']);

function publicJobState(job: RuntimeJob): string {
  const status = job.status.toUpperCase();
  if (COMPLETED.has(status)) {
    return job.completionReportId ? 'เสร็จแล้ว · มีรายงานผล' : 'ระบบรายงานว่าเสร็จแล้ว · ยังไม่พบรายงานยืนยัน';
  }
  if (FAILED.has(status)) return 'งานไม่สำเร็จ · ดูรายละเอียด';
  if (WAITING.has(status)) return 'มีเรื่องให้คุณตัดสินใจ';
  if (status === 'RUNNING' || status === 'EXECUTING' || status === 'IN_PROGRESS') return 'กำลังดำเนินงาน';
  return 'บันทึกงานแล้ว · รอเริ่มดำเนินการ';
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'ระบบตอบกลับไม่สำเร็จ กรุณาลองใหม่';
}

export function DsgConversationalWorkspace() {
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [jobs, setJobs] = useState<RuntimeJob[]>([]);
  const [jobsError, setJobsError] = useState('');
  const [submittingTasks, setSubmittingTasks] = useState(0);
  const [showJobs, setShowJobs] = useState(false);
  const history = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const feedEnd = useRef<HTMLDivElement | null>(null);

  const refreshJobs = useCallback(async () => {
    try {
      const response = await fetch('/api/dsg/jobs', { credentials: 'include', cache: 'no-store' });
      const body = await response.json() as JobsPayload;
      const loadedJobs = body.data?.jobs;
      if (!response.ok || !body.ok || !Array.isArray(loadedJobs)) {
        throw new Error(body.error?.message || body.error?.code || 'ตรวจรายการงานไม่ได้');
      }
      setJobs(loadedJobs);
      setJobsError('');
    } catch (error) {
      setJobsError(errorText(error));
    }
  }, []);

  useEffect(() => {
    void refreshJobs();
    // The database is authoritative; this timer only refreshes the UI.
    // Polling is independent of chat and never triggers an execution.
    const interval = window.setInterval(() => void refreshJobs(), 10000);
    return () => window.clearInterval(interval);
  }, [refreshJobs]);

  useEffect(() => {
    feedEnd.current?.scrollIntoView({ block: 'nearest' });
  }, [turns]);

  const append = (turn: Turn) => setTurns(items => [...items, turn]);
  const finish = (id: string, text: string) =>
    setTurns(items => items.map(item => item.id === id ? { ...item, text, pending: false } : item));

  async function submit(mode: 'chat' | 'task') {
    const message = draft.trim();
    if (!message || message.length > 4000) return;
    setDraft('');
    const replyId = crypto.randomUUID();
    append({ id: crypto.randomUUID(), role: 'user', text: message });
    append({ id: replyId, role: 'assistant', text: mode === 'chat' ? 'กำลังตอบ…' : 'กำลังรับงาน…', pending: true });

    if (mode === 'task') {
      // Durable recording is NOT proof that a provider has started running.
      // Do not pretend a queued job is an executed task.
      setSubmittingTasks(count => count + 1);
      try {
        const response = await fetch('/api/dsg/jobs', {
          method: 'POST', credentials: 'include', cache: 'no-store',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ goal: message }),
        });
        const data = await response.json() as JobsPayload;
        if (!response.ok || !data.ok || !data.data?.id) {
          throw new Error(data.error?.message || data.error?.code || 'ยังบันทึกงานไม่ได้');
        }
        setShowJobs(true);
        finish(replyId, 'รับงานไว้แล้ว ฉันจะแสดงความคืบหน้าจากระบบจริงในรายการงาน คุณคุยหรือมอบหมายงานใหม่ต่อได้เลย');
        await refreshJobs();
      } catch (error) {
        finish(replyId, 'ยังรับงานนี้ไม่สำเร็จ: ' + errorText(error));
      } finally {
        setSubmittingTasks(count => Math.max(0, count - 1));
      }
      return;
    }

    // Chat requests are independent. No global busy flag locks the composer
    // while another request or provider operation is pending.
    const previous = history.current.slice(-18);
    history.current = [...history.current, { role: 'user', content: message }].slice(-18);
    try {
      const response = await fetch('/api/dsg/agent-chat', {
        method: 'POST', credentials: 'include', cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message, history: previous, context: { surface: 'conversational_workroom' } }),
      });
      const data = await response.json() as ChatPayload;
      if (!response.ok || !data.ok) throw new Error(data.error?.message || data.error?.code || 'เอเจนต์ตอบกลับไม่ได้');
      const reply = normalizeAgentChatReply(data.data?.reply);
      const honestReply = data.data?.fallback
        ? 'ตอนนี้โมเดลหลักไม่พร้อม ระบบตอบด้วยโหมดสำรอง (ยังไม่ได้ Execute งาน)\n\n' + reply
        : reply;
      finish(replyId, honestReply);
      history.current = [...history.current, { role: 'assistant', content: honestReply }].slice(-18);
    } catch (error) {
      finish(replyId, 'ยังตอบไม่ได้: ' + errorText(error));
    }
  }

  return (
    <section aria-label="DSG ONE แชทและงานของฉัน" className="rounded-3xl border border-indigo-400/25 bg-slate-900 p-4 md:p-6">
      <header className="mb-4">
        <h2 className="text-xl font-bold text-white md:text-2xl">คุยกับ DSG ONE</h2>
        <p className="mt-1 text-sm text-slate-400">บอกสิ่งที่ต้องการเป็นภาษาธรรมชาติ คุยต่อได้แม้มีงานอื่นรออยู่</p>
      </header>

      <div aria-label="บทสนทนา" role="log" aria-live="polite"
        className="mb-4 min-h-48 max-h-[50vh] space-y-3 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
        {turns.length === 0 && (
          <div className="flex min-h-36 items-center justify-center text-center text-sm text-slate-400">
            <span><MessageSquare className="mx-auto mb-2 h-7 w-7" />วันนี้ให้ DSG ONE ช่วยอะไร?</span>
          </div>
        )}
        {turns.map(turn => (
          <div key={turn.id} className={`max-w-[94%] rounded-2xl px-4 py-3 text-sm leading-6 whitespace-pre-wrap break-words ${turn.role === 'user' ? 'ml-auto bg-indigo-700 text-white' : 'mr-auto border border-slate-800 bg-slate-900 text-slate-100'}`}>
            {turn.pending && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />}
            {turn.text}
          </div>
        ))}
        <div ref={feedEnd} />
      </div>

      <form onSubmit={event => { event.preventDefault(); void submit('chat'); }} className="space-y-3">
        <label htmlFor="dsg-conversation-input" className="sr-only">ข้อความถึง DSG ONE</label>
        <textarea id="dsg-conversation-input" value={draft} onChange={event => setDraft(event.target.value)}
          rows={3} maxLength={4000}
          className="min-h-24 w-full resize-y rounded-2xl border border-slate-700 bg-slate-950 p-4 text-base text-white outline-none focus:border-indigo-400"
          placeholder="เช่น ช่วยตรวจแอปของฉัน แล้วบอกว่าควรแก้ตรงไหน" />
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={!draft.trim()}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
            <ArrowUp className="h-4 w-4" /> ส่งข้อความ
          </button>
          <button type="button" disabled={!draft.trim()} onClick={() => void submit('task')}
            className="min-h-11 rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
            มอบหมายเป็นงาน
          </button>
        </div>
        {submittingTasks > 0 && <p role="status" className="text-xs text-indigo-200">กำลังบันทึกงาน {submittingTasks} รายการ โดยไม่หยุดแชท</p>}
      </form>

      <div className="mt-5 border-t border-slate-800 pt-4">
        <div className="flex items-center justify-between gap-2">
          <button type="button" aria-expanded={showJobs} onClick={() => setShowJobs(value => !value)}
            className="min-h-11 text-left text-sm font-semibold text-white">
            งานของฉัน ({jobs.length}) {showJobs ? '▴' : '▾'}
          </button>
          <button type="button" onClick={() => void refreshJobs()} className="min-h-11 rounded-xl border border-slate-700 px-3 text-xs text-slate-300">
            <RefreshCw className="mr-1 inline h-4 w-4" /> อัปเดต
          </button>
        </div>
        {showJobs && (
          <div className="mt-3 space-y-2" aria-label="สถานะงานจริง">
            {jobsError && <p role="alert" className="text-sm text-amber-200">ยังอ่านสถานะงานไม่ได้: {jobsError}</p>}
            {!jobsError && jobs.length === 0 && <p className="text-sm text-slate-400">ยังไม่มีงานที่บันทึกในพื้นที่นี้</p>}
            {jobs.map(job => (
              <article key={job.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <p className="line-clamp-2 text-sm font-medium">{job.goal}</p>
                <p className="mt-1 text-xs text-slate-400">{publicJobState(job)}</p>
                {WAITING.has(job.status.toUpperCase()) && (
                  <a href="/dsg/approvals" className="mt-2 inline-block text-xs text-indigo-300">ดูรายละเอียดหรือคำขออนุมัติ</a>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
