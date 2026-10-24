'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Monitor, ShieldCheck } from 'lucide-react';

type Session = {
  ok?: boolean;
  actor?: { email?: string | null };
  memberships?: { workspace_id: string; role: string }[];
};

export default function DsgPilotPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [workspaceName, setWorkspaceName] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/dsg/access/session', { credentials: 'same-origin', cache: 'no-store' })
      .then(async response => response.ok ? await response.json() as Session : null)
      .then(value => { if (alive) setSession(value); })
      .catch(() => { if (alive) setSession(null); })
      .finally(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, []);

  async function requestPilot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/dsg/pilot/request', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workspaceName, fullName }),
      });
      const payload = await response.json() as { ok?: boolean; error?: string; status?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? 'PILOT_REQUEST_FAILED');
      setRequested(true);
      setMessage('ส่งคำขอทดลองสำเร็จ · PENDING_REVIEW · ยังไม่ได้รับสิทธิ์ควบคุม Agent หรือเครื่อง');
    } catch (failure) {
      setMessage('ส่งคำขอไม่สำเร็จ: ' + (failure instanceof Error ? failure.message : 'PILOT_REQUEST_FAILED'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-2 text-sm font-bold text-cyan-300"><ShieldCheck size={18} /> DSG ONE v1 · Pilot Access</div>
        <h1 className="mt-5 text-3xl font-black sm:text-5xl">ทดลอง DSG ONE กับบัญชีของคุณ</h1>
        <p className="mt-5 text-base leading-8 text-slate-300">
          ใช้ระบบสมาชิก DSG ONE v1 เดิมเพื่อลงทะเบียนขอสิทธิ์ทดลอง
          สิทธิ์ Pilot และการอนุมัติให้ Agent ทำงานเป็นคนละขั้นตอนกัน
        </p>
        <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
          <div className="text-sm font-bold text-cyan-300">1 · DSG ONE Account</div>
          {checking ? (
            <p className="mt-4 text-slate-400">กำลังตรวจบัญชี…</p>
          ) : session?.ok ? (
            <p className="mt-4 text-sm text-emerald-200">เข้าสู่ระบบแล้ว: {session.actor?.email ?? 'บัญชี DSG ONE'} · ระบบสมาชิกยังไม่ใช่สิทธิ์เข้า AppDeploy</p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/signup" className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950">สมัครบัญชี</Link>
              <Link href="/login?next=/try" className="rounded-xl border border-slate-600 px-4 py-3 text-sm font-bold">มีบัญชีแล้ว? เข้าสู่ระบบ</Link>
            </div>
          )}
          <div className="mt-8 text-sm font-bold text-cyan-300">2 · Request Pilot Access</div>
          {session?.ok ? (
            <form onSubmit={requestPilot} className="mt-4 space-y-4">
              <label className="block text-sm font-semibold">ชื่อองค์กรหรือพื้นที่ทดลอง
                <input required minLength={2} maxLength={100} value={workspaceName} onChange={e => setWorkspaceName(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Company or project" />
              </label>
              <label className="block text-sm font-semibold">ชื่อผู้ติดต่อ (ไม่บังคับ)
                <input maxLength={100} value={fullName} onChange={e => setFullName(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Your name" />
              </label>
              <button type="submit" disabled={busy || requested} className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-50">
                {requested ? 'ส่งคำขอแล้ว' : busy ? 'กำลังส่ง…' : 'ขอสิทธิ์ทดลอง'} <ArrowRight className="ml-2 inline h-4 w-4" />
              </button>
            </form>
          ) : (
            <p className="mt-4 text-sm text-slate-400">เข้าสู่ระบบ DSG ONE ก่อนส่งคำขอ สิทธิ์ทดลองจะไม่ถูกเปิดอัตโนมัติ</p>
          )}
          {message && <div role="status" className="mt-5 rounded-xl border border-slate-700 p-4 text-sm text-slate-200">{message}</div>}
        </section>
        <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
          <div className="flex items-center gap-2 text-sm font-bold text-cyan-300"><Monitor size={18} /> 3 · Cloud Computer</div>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            แอป Cloud Computer บน AppDeploy ยังเป็น Owner-only จนกว่าจะมีการเชื่อม Session และตรวจสิทธิ์ Pilot ที่ได้รับอนุมัติแล้วจาก DSG ONE แบบ Server-side
          </p>
          <a href="https://dsg-one-cloud-computer-dmsmbp.v2.appdeploy.ai/" target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm font-bold text-cyan-300 underline">ดู Cloud Computer (Owner-only)</a>
        </section>
      </div>
    </main>
  );
}