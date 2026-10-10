'use client';

import { createAuth0Client, type Auth0Client } from '@auth0/auth0-spa-js';
import { useEffect, useRef, useState } from 'react';

const CALLBACK = 'https://dsg.pics/dsg/approvals';
const AUDIENCE = 'https://aws.dsg.pics';
const SCOPE = 'openid profile email dsg.approve';

type Approval = {
  approval_request_id: string;
  plan_id?: string;
  plan_hash?: string;
  route_id?: string;
  risk?: string;
  risk_tier?: string;
  status?: string;
  payload?: Record<string, unknown>;
  requester?: { principal?: string; kind?: string; client_id?: string };
  subject_hash?: string;
  expires_at?: string;
};
type ToolResponse = {
  ok?: boolean;
  error?: string;
  receipt?: { verdict?: string; reason?: string; approvals?: Approval[]; approval?: Approval };
};

export default function ApprovalClient() {
  const client = useRef<Auth0Client | null>(null);
  const [siteReady, setSiteReady] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [selected, setSelected] = useState<Approval | null>(null);
  const [status, setStatus] = useState('กำลังตรวจสอบสิทธิ์เว็บไซต์ DSG ONE');

  useEffect(() => {
    let live = true;
    async function initialize() {
      try {
        const session = await fetch('/api/dsg/identity/link', {
          credentials: 'include', cache: 'no-store',
        });
        const data = await session.json() as { ok?: boolean; linked?: boolean };
        if (!session.ok || !data.ok || !data.linked) {
          if (live) setStatus('ต้องเข้าสู่ระบบ DSG ONE และเชื่อมบัญชี Auth0 ที่ /dsg/autonomous-level ก่อน');
          return;
        }
        if (!live) return;
        setSiteReady(true);
        const c = await createAuth0Client({
          domain: 'dev-kcddqmnusbxxo25s.us.auth0.com',
          clientId: 'mLIAcMEAhuVDaUvzXn8Qo54zj2llFp3X',
          authorizationParams: { redirect_uri: CALLBACK, audience: AUDIENCE, scope: SCOPE },
          cacheLocation: 'memory',
          useRefreshTokens: false,
        });
        client.current = c;
        if (!live) return;
        setAuthReady(true);
        const params = new URLSearchParams(window.location.search);
        if (params.has('error')) {
          setStatus('Auth0 ไม่อนุญาตให้เข้าสู่ระบบหรือ scope dsg.approve ยังไม่ได้รับสิทธิ์');
          window.history.replaceState(null, '', CALLBACK);
          return;
        }
        if (params.has('code') && params.has('state')) {
          await c.handleRedirectCallback();
          window.history.replaceState(null, '', CALLBACK);
        }
        setStatus('พร้อมตรวจรายการรออนุมัติ — ต้องมี Auth0 scope dsg.approve');
      } catch {
        if (live) setStatus('ไม่สามารถยืนยันเซสชันเว็บไซต์ / Auth0 ได้');
      }
    }
    void initialize();
    return () => { live = false; };
  }, []);

  async function obtainToken() {
    if (!client.current) throw new Error('AUTH0_SESSION_NOT_READY');
    // Always obtain a fresh access token at the tap. No localStorage or logs.
    return client.current.getTokenSilently({
      authorizationParams: { audience: AUDIENCE, scope: SCOPE },
      cacheMode: 'off',
    });
  }

  async function tool(name: string, args: Record<string, unknown>): Promise<ToolResponse> {
    const accessToken = await obtainToken();
    const res = await fetch('/api/dsg/spacetime/user-tools', {
      method: 'POST', credentials: 'include', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: name, arguments: args, accessToken }),
    });
    const payload = await res.json() as ToolResponse;
    if (!res.ok || !payload.ok) throw new Error(payload.error || payload.receipt?.reason || 'MCP_REJECTED');
    return payload;
  }

  async function login() {
    if (!client.current) return;
    setBusy(true);
    try {
      await client.current.loginWithRedirect({
        authorizationParams: { redirect_uri: CALLBACK, audience: AUDIENCE, scope: SCOPE },
      });
    } catch {
      setStatus('AUTH0_REDIRECT_FAILED — ตรวจ Allowed Callback URLs และ dsg.approve');
      setBusy(false);
    }
  }

  async function load() {
    setBusy(true);
    setSelected(null);
    try {
      const data = await tool('spacetime_list_pending_approvals', {});
      setApprovals(data.receipt?.approvals || []);
      setStatus('อ่านรายการคำขอจาก DSG Spacetime สำเร็จ (ไม่ใช่ผล Execute)');
    } catch (err) {
      setStatus('ไม่สามารถอ่านรายการ: ' + (err instanceof Error ? err.message : 'NOT_VERIFIED'));
    } finally { setBusy(false); }
  }

  async function review(id: string) {
    setBusy(true);
    try {
      const data = await tool('spacetime_get_approval', { approval_request_id: id });
      if (!data.receipt?.approval) throw new Error('APPROVAL_DETAILS_UNAVAILABLE');
      setSelected(data.receipt.approval);
      setStatus('โปรดตรวจรายละเอียดงานและ payload ที่จะอนุมัติก่อนตัดสินใจ');
    } catch (err) {
      setStatus('ตรวจคำขอไม่ได้: ' + (err instanceof Error ? err.message : 'NOT_VERIFIED'));
    } finally { setBusy(false); }
  }

  async function decide(decision: 'APPROVE' | 'REJECT') {
    if (!selected) return;
    if (selected.risk_tier === 'high' && decision === 'APPROVE') {
      setStatus('BLOCKED: งานความเสี่ยงสูงยังต้องพิสูจน์ Auth0 step-up ก่อนอนุมัติ');
      return;
    }
    setBusy(true);
    try {
      const data = await tool('spacetime_resolve_approval', {
        approval_request_id: selected.approval_request_id, decision,
      });
      if (data.receipt?.verdict !== (decision === 'APPROVE' ? 'APPROVED' : 'REJECTED')) {
        throw new Error(data.receipt?.reason || 'APPROVAL_RESULT_NOT_VERIFIED');
      }
      setStatus(decision === 'APPROVE'
        ? 'APPROVED — ผู้ขออนุมัติต้อง claim permit และส่งหลักฐาน Execute กลับมา'
        : 'REJECTED — การทำงานนี้ไม่ได้รับอนุญาต');
      setSelected(null);
      setApprovals(items => items.filter(item => item.approval_request_id !== selected.approval_request_id));
    } catch (err) {
      setStatus('ดำเนินการไม่ผ่าน: ' + (err instanceof Error ? err.message : 'NOT_VERIFIED'));
    } finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <section className="mx-auto max-w-3xl space-y-5 rounded-2xl border border-slate-700 bg-slate-900 p-5">
        <h1 className="text-2xl font-bold">DSG · คำขออนุมัติจากผู้ใช้จริง</h1>
        <p className="text-sm text-slate-300">ใช้บัญชี Auth0 ที่ผูกกับ DSG ONE ของคุณ ไม่ใช้ Owner key หรือ internal key แทน</p>
        <p role="status" aria-live="polite" className="rounded-lg border border-slate-700 p-3 text-sm">{status}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void login()} disabled={!siteReady || !authReady || busy}
            className="rounded-lg bg-indigo-600 px-4 py-2 disabled:opacity-40">เข้าสู่ระบบเพื่ออนุมัติ</button>
          <button type="button" onClick={() => void load()} disabled={!siteReady || !authReady || busy}
            className="rounded-lg border border-slate-500 px-4 py-2 disabled:opacity-40">ดูรายการรออนุมัติ</button>
          <a href="/dsg/autonomous-level" className="rounded-lg border border-slate-500 px-4 py-2">กลับหน้าสถานะระบบ</a>
        </div>
        <h2 className="font-semibold">คำขอ ({approvals.length})</h2>
        {approvals.map(item => (
          <div key={item.approval_request_id} className="rounded-lg border border-slate-700 p-3">
            <p className="break-all text-sm">{item.route_id || item.plan_id || 'รายการรออนุมัติ'}</p>
            <button type="button" disabled={busy} onClick={() => void review(item.approval_request_id)}
              className="mt-2 rounded bg-slate-700 px-3 py-2 text-sm disabled:opacity-40">ตรวจรายละเอียด</button>
          </div>
        ))}
        {selected && (
          <section className="space-y-3 rounded-lg border border-amber-500/40 p-4">
            <h2 className="font-semibold">ตรวจคำขอก่อนอนุมัติ</h2>
            <p className="break-all text-sm">Route: {selected.route_id || 'ไม่พบ'} · Risk: {selected.risk || 'unknown'}</p>
            <p className="break-all text-sm">Requester: {selected.requester?.principal || 'ไม่พบ'}</p>
            <p className="break-all text-sm">Plan hash: {selected.plan_hash || 'ไม่พบ'}</p>
            <p className="text-sm">หมดอายุ: {selected.expires_at || 'ไม่พบ'}</p>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-950 p-3 text-xs">
              {JSON.stringify(selected.payload, null, 2)}
            </pre>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy || selected.risk_tier === 'high'}
                onClick={() => void decide('APPROVE')}
                className="rounded-lg bg-emerald-700 px-4 py-2 disabled:opacity-40">อนุมัติงานนี้</button>
              <button type="button" disabled={busy} onClick={() => void decide('REJECT')}
                className="rounded-lg bg-rose-700 px-4 py-2 disabled:opacity-40">ปฏิเสธ</button>
            </div>
            {selected.risk_tier === 'high' && <p className="text-amber-200 text-sm">ยังไม่เปิดอนุมัติงาน High Risk จนกว่าจะมีหลักฐาน step-up Authentication</p>}
          </section>
        )}
      </section>
    </main>
  );
}
