'use client';

import { useCallback, useEffect, useState } from 'react';
import { DsgOperatorChat } from '@/components/dsg-operator-chat';
import { DsgLiveWorkroom } from '@/components/dsg-live-workroom';
import { AgentCommandCenter } from '@/components/agent-command-center';
import { PublicProductionSnapshot } from '@/components/public-production-snapshot';

// Only UI deep-links. No credentials, model payloads or permits are stored in URLs.
function isToolDeepLink(tool: string | null): boolean {
  return ['browser', 'desktop'].includes(tool || '') || tool === 'agent-v0';
}

type Membership = { workspace_id: string; role: 'OWNER' | 'ADMIN' | 'OPERATOR' | 'AUDITOR' | 'VIEWER' };
type SessionPayload = {
  ok: boolean;
  memberships?: Membership[];
  selected?: Membership | null;
  error?: string;
};

export default function DsgWorkroomPage() {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyWorkspace, setBusyWorkspace] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(() =>
    typeof window !== 'undefined' && isToolDeepLink(new URLSearchParams(window.location.search).get('tool'))
  );

  const load = useCallback(async () => {
    try {
      let response = await fetch('/api/dsg/access/session', {
        credentials: 'include', cache: 'no-store',
      });
      if (response.status === 401) {
        // An expired access cookie is not proof that the user has signed out.
        // Try the existing HttpOnly refresh cookie once, server-side, before
        // asking the user to type a password again. Never expose a token in JS.
        const renewal = await fetch('/api/auth/refresh', {
          method: 'POST', credentials: 'include', cache: 'no-store',
        });
        if (renewal.ok) {
          response = await fetch('/api/dsg/access/session', {
            credentials: 'include', cache: 'no-store',
          });
        } else if (renewal.status !== 401) {
          throw new Error('ระบบยืนยันตัวตนไม่พร้อมต่ออายุเซสชัน กดลองอีกครั้งโดยไม่ต้องออกจากระบบ');
        }
      }
      if (response.status === 401) {
        // The refresh credential is absent or invalid: genuine sign-in is needed.
        // Preserve the requested tool and return to the same task after login.
        const returnTo = window.location.pathname + window.location.search;
        window.location.assign('/login?next=' + encodeURIComponent(returnTo));
        return;
      }
      const payload = await response.json() as SessionPayload;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'ไม่สามารถเข้าถึงพื้นที่ทำงานได้');
      }
      setSession(payload);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ตรวจพื้นที่ทำงานไม่ได้');
    } finally {
      setLoading(false);
    }
  }, []);

  const selectWorkspace = useCallback(async (workspaceId: string) => {
    setBusyWorkspace(workspaceId);
    try {
      const response = await fetch('/api/dsg/access/workspace', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workspaceId }), credentials: 'include',
      });
      const payload = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'เลือกพื้นที่ทำงานไม่ได้');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'เลือกพื้นที่ทำงานไม่ได้');
    } finally {
      setBusyWorkspace(null);
    }
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    if (!session || session.selected || session.memberships?.length !== 1 || busyWorkspace) return undefined;
    const timer = window.setTimeout(() => void selectWorkspace(session.memberships![0].workspace_id), 0);
    return () => window.clearTimeout(timer);
  }, [session, busyWorkspace, selectWorkspace]);

  const selected = session?.selected ?? null;
  const openAgentV0 = useCallback(() => {
    setAdvancedOpen(true);
    const next = new URL(window.location.href);
    next.searchParams.set('tool', 'agent-v0');
    next.hash = 'live-controls';
    window.history.replaceState(window.history.state, '', next.pathname + next.search + next.hash);
    window.setTimeout(() => document.getElementById('live-controls')?.scrollIntoView({ block: 'start' }), 100);
  }, []);

  // The entry link can arrive before a workspace has been selected.
  // After the protected session becomes ready, reveal the real Cinema controls
  // instead of leaving the user at the top of a long Agent Chat screen.
  useEffect(() => {
    if (!selected || !advancedOpen) return undefined;
    if (!isToolDeepLink(new URLSearchParams(window.location.search).get('tool'))) return undefined;
    const timer = window.setTimeout(() => {
      document.getElementById('live-controls')?.scrollIntoView({ block: 'start' });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [selected, advancedOpen]);

  return (
    <main className="min-h-full bg-slate-950 px-2 py-3 text-slate-100 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-4xl">
        {selected && (
          <section aria-label="เริ่มใช้งาน DSG ONE" className="mb-3 rounded-2xl border border-indigo-500/30 bg-slate-900 p-3 sm:p-4">
            <p className="text-sm font-semibold text-white">บอกงานที่ต้องการได้เลย — ระบบจะแสดงความคืบหน้าและผลตามจริง</p>
            <nav aria-label="ทางลัดการทำงาน" className="mt-3 flex flex-wrap gap-2 text-sm">
              <a href="#dsg-chat-message" className="min-h-11 rounded-xl bg-indigo-700 px-3 py-3 font-semibold text-white">1. สั่งงาน</a>
              <button type="button" onClick={openAgentV0} aria-controls="dsg-advanced-tools"
                className="min-h-11 rounded-xl border border-indigo-500 px-3 py-3 font-semibold text-indigo-100">วางแผนด้วย DSG Agent v0 (Qwen)</button>
              <a href="#dsg-jobs" onClick={() => document.getElementById('dsg-jobs')?.setAttribute('open', '')}
                className="min-h-11 rounded-xl border border-slate-700 px-3 py-3 text-slate-200">2. ติดตามงาน</a>
              <a href="/dsg/approvals" className="min-h-11 rounded-xl border border-slate-700 px-3 py-3 text-slate-200">3. อนุมัติเมื่อจำเป็น</a>
              <a href="/control/" className="min-h-11 rounded-xl border border-slate-700 px-3 py-3 text-slate-200">เครื่องที่เชื่อมต่อ</a>
            </nav>
          </section>
        )}
        {selected ? (
          <DsgOperatorChat key={selected.workspace_id} />
        ) : (
          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <h1 className="text-xl font-bold">DSG ONE</h1>
            <p role="status" className="mt-3 text-sm text-slate-300">
              {loading || busyWorkspace ? 'กำลังเปิดพื้นที่สนทนา…' : message || 'เลือกพื้นที่สำหรับเริ่มสนทนา'}
            </p>
            {!loading && !busyWorkspace && (session?.memberships ?? []).length > 1 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {session!.memberships!.map((membership, index) => (
                  <button key={membership.workspace_id}
                    disabled={busyWorkspace !== null}
                    onClick={() => void selectWorkspace(membership.workspace_id)}
                    className="min-h-11 rounded-xl border border-indigo-400 px-4 py-2 text-sm text-white">
                    พื้นที่ทำงาน {index + 1}
                  </button>
                ))}
              </div>
            )}
            {!loading && (session?.memberships?.length ?? 0) === 0 && !message && (
              <p className="mt-2 text-sm text-amber-200">ไม่พบพื้นที่ทำงานของบัญชีนี้</p>
            )}
            {!loading && <button onClick={() => void load()}
              className="mt-4 min-h-11 rounded-xl border border-slate-700 px-4 text-sm">ลองอีกครั้ง</button>}
          </section>
        )}
        {selected && (
          <details id="dsg-advanced-tools" open={advancedOpen} className="mt-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
            onToggle={event => setAdvancedOpen(event.currentTarget.open)}>
            <summary className="cursor-pointer text-sm text-slate-400">Agent v0 · ควบคุมเว็บและอุปกรณ์ · เครื่องมือเพิ่มเติม</summary>
            {advancedOpen && (
              <div className="mt-4 space-y-5">
                <p className="text-sm text-slate-400">
                  วางแผนด้วย DSG Agent v0 หรือควบคุมเว็บ/อุปกรณ์จริงจากแท็บด้านล่าง หากโมเดลหรืออุปกรณ์ยังไม่พร้อม ระบบจะแจ้งเหตุผล ไม่แสดงผลสำเร็จจำลอง
                </p>
                <DsgLiveWorkroom key={selected.workspace_id} />
                <AgentCommandCenter />
                <PublicProductionSnapshot compact />
                <nav aria-label="เครื่องมือขั้นสูง" className="flex flex-wrap gap-3 text-sm text-indigo-200">
                  <a href="/dsg/workroom?tool=agent-v0#live-controls">Agent v0 · Qwen Planner</a>
                  <a href="/dsg/app-builder">สร้างแอป</a>
                  <a href="/dsg/approvals">คำขออนุมัติ</a>
                  <a href="/control/">เครื่องที่เชื่อมต่อ</a>
                  <a href="/dsg/workroom?tool=browser#live-controls">ควบคุมเว็บ</a>
                  <a href="https://aws.dsg.pics/app" target="_blank" rel="noopener noreferrer">ตรวจหลักฐาน (ขั้นสูง) ↗</a>
                </nav>
              </div>
            )}
          </details>
        )}
      </div>
    </main>
  );
}
