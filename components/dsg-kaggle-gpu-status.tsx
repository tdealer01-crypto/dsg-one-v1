'use client';

import { useCallback, useEffect, useState } from 'react';
import { getDsgBrowserSession, DSG_AUTH0_CALLBACK } from '@/lib/dsg/user-bound/browser-session';
import { classifyAuth0SessionFailure } from '@/lib/dsg/user-bound/oauth-refresh';

type SafeState = 'QUEUED' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILED' | 'UNKNOWN';
type Entry = { name: 'OWNER_LAUNCH' | 'GOVERNED_E2E' | 'STOP_PROOF'; state: SafeState; runId: number; updatedAt: string };
type Lifecycle = { ok: boolean; connected?: boolean; dispatchConfigured?: boolean; source?: string; gpuState?: string; workflows?: Entry[]; error?: string };

const labels: Record<Entry['name'], string> = {
  OWNER_LAUNCH: 'เปิด Kaggle Worker',
  GOVERNED_E2E: 'การทดสอบ Governed E2E',
  STOP_PROOF: 'หลักฐานการหยุด GPU',
};
const states: Record<SafeState, string> = {
  QUEUED: 'รอเริ่ม Workflow',
  IN_PROGRESS: 'Workflow กำลังทำงาน (ยังไม่ยืนยัน GPU)',
  SUCCESS: 'Workflow ผ่าน (ยังไม่ใช่หลักฐานว่า GPU ออนไลน์)',
  FAILED: 'Workflow ไม่ผ่าน',
  UNKNOWN: 'ไม่ทราบสถานะ',
};

export function DsgKaggleGpuStatus() {
  const [data, setData] = useState<Lifecycle | null>(null);
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startResult, setStartResult] = useState<string | null>(null);
  const [signInRequired, setSignInRequired] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/dsg/agent-v0/lifecycle', { credentials: 'include', cache: 'no-store' });
      const reply = await res.json() as Lifecycle;
      setData(res.ok ? reply : { ok: false, error: reply.error ?? 'KAGGLE_STATUS_UNAVAILABLE' });
    } catch {
      setData({ ok: false, error: 'KAGGLE_STATUS_UNAVAILABLE' });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  async function signInForKaggle() {
    setStarting(true);
    setStartResult('กำลังเปิด Auth0 เพื่อตรวจสิทธิ์เจ้าของ · หลังเข้าสู่ระบบให้กดเปิด GPU อีกครั้ง');
    try {
      await getDsgBrowserSession().loginWithRedirect({
        authorizationParams: { redirect_uri: DSG_AUTH0_CALLBACK },
        // Exact allowlisted Workroom tab is restored by identity-bridge.
        appState: { returnTo: '/dsg/workroom?tool=agent-v0' },
      });
    } catch {
      setStartResult('AUTH0_OWNER_LOGIN_REDIRECT_UNAVAILABLE · ใช้ปุ่มเข้าสู่ระบบเครื่องมือด้านบน');
    } finally {
      setStarting(false);
    }
  }

  async function startFreeGpu() {
    if (!data?.ok || data.dispatchConfigured !== true || starting) return;
    setStarting(true);
    setStartResult(null);
    try {
      const session = getDsgBrowserSession();
      if (!await session.isAuthenticated()) {
        setSignInRequired(true);
        // User clicked to start; redirect only on this explicit interaction.
        // Never silently loop through Auth0 or dispatch a kernel before login.
        await signInForKaggle();
        return;
      }
      let accessToken: string;
      try {
        accessToken = await session.getTokenSilently();
        if (!accessToken) throw new Error('AUTH0_NO_DELEGATED_TOKEN');
      } catch (error) {
        const reason = classifyAuth0SessionFailure(error);
        setSignInRequired(reason === 'AUTH0_REFRESH_NOT_AVAILABLE');
        setStartResult(reason === 'AUTH0_REFRESH_NOT_AVAILABLE'
          ? 'AUTH0_REAUTH_REQUIRED · กดเข้าสู่ระบบเครื่องมือ แล้วกลับมาเปิด GPU'
          : 'AUTH0_IDENTITY_UNAVAILABLE · โปรดลองตรวจเซสชันหรือเครือข่าย');
        return;
      }
      setSignInRequired(false);
      const res = await fetch('/api/dsg/agent-v0/launch', {
        method: 'POST', credentials: 'include', cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'start_free_gpu', accessToken }),
      });
      let outcome: { ok?: boolean; error?: string; status?: string };
      try {
        outcome = await res.json() as typeof outcome;
      } catch {
        setStartResult('KAGGLE_OWNER_RESPONSE_UNREADABLE · ไม่มีหลักฐานว่า GPU เริ่มแล้ว');
        return;
      }
      if (!res.ok || !outcome.ok) {
        // This is a fixed, server-sanitized code, never Auth0/GitHub raw text.
        const code = typeof outcome.error === 'string' && /^[A-Z0-9_]{3,100}$/.test(outcome.error)
          ? outcome.error : 'KAGGLE_OWNER_DISPATCH_UNAVAILABLE';
        setStartResult(code);
        if (code === 'KAGGLE_SIGNED_AUTH0_USER_REQUIRED' ||
            code === 'KAGGLE_VERIFIED_OWNER_SESSION_REQUIRED') setSignInRequired(true);
      } else {
        setStartResult('GitHub รับคำขอเปิด GPU แล้ว · รอ Kaggle ตรวจโควตาฟรีและยืนยัน Worker จริง');
      }
      await refresh();
    } catch {
      setStartResult('KAGGLE_OWNER_NETWORK_UNAVAILABLE · ไม่มีหลักฐานว่า GPU เริ่มแล้ว');
    } finally {
      setStarting(false);
    }
  }

  return (
    <section aria-label="สถานะ Kaggle GPU ของ DSG Agent v0" className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">สถานะ Agent v0 · Kaggle ฟรี</h3>
        <button type="button" onClick={() => void refresh()} disabled={busy}
          className="min-h-11 rounded-lg border border-slate-600 px-3 py-2 text-sm disabled:opacity-50">
          {busy ? 'กำลังตรวจ…' : 'ตรวจสถานะใหม่'}
        </button>
      </div>
      <p className="mt-2 text-amber-200">
        สถานะ GPU: ยังไม่ยืนยันจาก Kaggle โดยตรง · Workroom ไม่ได้เปิด GPU อัตโนมัติในเวอร์ชันนี้
      </p>
      {data?.ok && (
        <div className="mt-3 space-y-2">
          <button type="button" onClick={() => void (signInRequired ? signInForKaggle() : startFreeGpu())}
            disabled={busy || starting || data.dispatchConfigured !== true}
            className="min-h-11 rounded-lg border border-indigo-400 bg-indigo-800 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {starting ? 'กำลังตรวจสิทธิ์…' : signInRequired ? 'เข้าสู่ระบบเครื่องมือเพื่อเปิด GPU' : 'เปิด Kaggle GPU ฟรี'}
          </button>
          {data.dispatchConfigured !== true && (
            <p className="text-amber-200">
              ยังไม่เชื่อมสิทธิ์ Dispatch ของเจ้าของบนเซิร์ฟเวอร์ · ปุ่มเปิด GPU จึงไม่พร้อมใช้งาน
            </p>
          )}
          {startResult && <p role="status" className="text-slate-200">{startResult}</p>}
        </div>
      )}
      {data?.ok && data.connected === false && (
        <p className="mt-2 text-slate-300">ยังไม่เชื่อมสิทธิ์อ่าน Workflow ฝั่งเซิร์ฟเวอร์ จึงตรวจสถานะการเปิด GPU ไม่ได้</p>
      )}
      {data?.ok && data.connected === true && (
        <div className="mt-2 space-y-1">
          {data.workflows?.length ? data.workflows.map(item => (
            <p key={item.name}>
              <span className="text-slate-200">{labels[item.name]}: </span>
              <span>{states[item.state]}</span>
            </p>
          )) : <p>ยังไม่มีหลักฐาน Run ที่อ่านได้</p>}
        </div>
      )}
      {data && !data.ok && <p role="status" className="mt-2 text-amber-200">ตรวจสถานะไม่ได้: {data.error}</p>}
      <p className="mt-2 text-xs text-slate-400">
        การส่งคำขอผ่าน Workroom ไม่ใช่หลักฐานว่า GPU พร้อมใช้ · Kaggle จะตรวจโควตาฟรีและยืนยัน Kernel ก่อนอนุญาตให้ใช้งาน
        ระบบจะไม่เปิด GPU ที่คิดเงินหรือรายงาน READY โดยไม่มีหลักฐานจริง
      </p>
    </section>
  );
}
