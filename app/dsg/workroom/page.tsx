'use client';

import { useCallback, useEffect, useState } from 'react';
import { DsgOperatorChat } from '@/components/dsg-operator-chat';
import { DsgLiveWorkroom } from '@/components/dsg-live-workroom';
import { AgentCommandCenter } from '@/components/agent-command-center';
import { PublicProductionSnapshot } from '@/components/public-production-snapshot';

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
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/dsg/access/session', {
        credentials: 'include', cache: 'no-store',
      });
      if (response.status === 401) {
        window.location.assign('/login?next=/dsg/workroom');
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

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!session || session.selected || session.memberships?.length !== 1 || busyWorkspace) return;
    void selectWorkspace(session.memberships[0].workspace_id);
  }, [session, busyWorkspace, selectWorkspace]);

  const selected = session?.selected ?? null;

  return (
    <main className="min-h-full bg-slate-950 px-2 py-3 text-slate-100 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-4xl">
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
          <details className="mt-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
            onToggle={event => setAdvancedOpen(event.currentTarget.open)}>
            <summary className="cursor-pointer text-sm text-slate-400">เครื่องมือเพิ่มเติมสำหรับผู้ดูแลระบบ</summary>
            {advancedOpen && (
              <div className="mt-4 space-y-5">
                <p className="text-sm text-slate-400">
                  คำสั่งขั้นสูงและหลักฐานทางเทคนิคอยู่ในส่วนนี้ แชทด้านบนยังใช้งานแยกกันได้
                </p>
                <DsgLiveWorkroom key={selected.workspace_id} />
                <AgentCommandCenter />
                <PublicProductionSnapshot compact />
                <nav aria-label="เครื่องมือขั้นสูง" className="flex flex-wrap gap-3 text-sm text-indigo-200">
                  <a href="/dsg/app-builder">App Builder</a>
                  <a href="/dsg/approvals">Approvals</a>
                  <a href="/control/">AWS Workroom</a>
                  <a href="https://aws.dsg.pics/app" target="_blank" rel="noreferrer">Cinema</a>
                </nav>
              </div>
            )}
          </details>
        )}
      </div>
    </main>
  );
}
