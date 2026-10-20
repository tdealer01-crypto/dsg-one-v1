'use client';

import { Auth0Client } from '@auth0/auth0-spa-js';
import { useCallback, useEffect, useRef, useState } from 'react';

const CALLBACK = 'https://dsg.pics/dsg/approvals';
const AUDIENCE = 'https://aws.dsg.pics';
const SCOPE = 'openid profile email dsg.approve';

// Unknown risk is NEVER implicitly downgraded to a standard approval.
export function knownRiskTier(tier: unknown): tier is 'standard' | 'high' {
  return tier === 'standard' || tier === 'high';
}

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

type StepUpIntent =
  | { kind: 'mfa_probe' }
  | { kind: 'approve'; approvalRequestId: string };

type ReviewIntent = { kind: 'review'; approvalRequestId: string };

function isValidApprovalRequestId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 192 && !/\s/.test(value);
}

function isStepUpIntent(value: unknown): value is StepUpIntent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as { kind?: unknown; approvalRequestId?: unknown };
  return candidate.kind === 'mfa_probe' ||
    (candidate.kind === 'approve' && isValidApprovalRequestId(candidate.approvalRequestId));
}

function isReviewIntent(value: unknown): value is ReviewIntent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as { kind?: unknown; approvalRequestId?: unknown };
  return candidate.kind === 'review' && isValidApprovalRequestId(candidate.approvalRequestId);
}

export default function ApprovalClient() {
  const client = useRef<Auth0Client | null>(null);
  const reviewedApprovalId = useRef<string | null>(null);
  const completingStepUpId = useRef<string | null>(null);
  const initialListLoaded = useRef(false);
  const [authReady, setAuthReady] = useState(false);
  const [tokenReady, setTokenReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingStepUpIntent, setPendingStepUpIntent] = useState<StepUpIntent | null>(null);
  const [requestedApprovalId, setRequestedApprovalId] = useState<string | null>(null);
  const [manualApprovalId, setManualApprovalId] = useState('');
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [selected, setSelected] = useState<Approval | null>(null);
  const [status, setStatus] = useState('กำลังตรวจสอบเซสชัน Auth0 สำหรับการอนุมัติ');

  useEffect(() => {
    let live = true;
    async function initialize() {
      try {
        // The human-approver Auth0 credential is independently verified by
        // the website relay and AWS. A second Supabase/site login here caused
        // a redirect loop, especially when returning from MFA on Android.
        // Do not block the Auth0 callback on an unrelated website session.
        if (!live) return;
        // Handle redirects exactly once here, including Android app switching.
        // createAuth0Client can automatically consume the callback before the
        // explicit handler below sees the exact-request appState.
        const c = new Auth0Client({
          domain: 'dev-kcddqmnusbxxo25s.us.auth0.com',
          clientId: 'jI1uiKcQu7mqORsaCrogKTQVsAcZuQSt',
          authorizationParams: { redirect_uri: CALLBACK, audience: AUDIENCE, scope: SCOPE },
          cacheLocation: 'memory',
          useRefreshTokens: false,
        });
        client.current = c;
        if (!live) return;
        setAuthReady(true);
        const params = new URLSearchParams(window.location.search);
        const queryApprovalId = params.get('approval_request_id');
        let reviewApprovalId: string | null = isValidApprovalRequestId(queryApprovalId)
          ? queryApprovalId : null;
        if (reviewApprovalId) setManualApprovalId(reviewApprovalId);
        let stepUpIntent: StepUpIntent | null = null;
        if (params.has('error')) {
          setStatus('Auth0 ไม่อนุญาต: ' + (params.get('error') || 'AUTH0_CALLBACK_ERROR') +
            ' — ยังไม่อนุมัติงานนี้ โปรดลองจากเบราว์เซอร์เดิม');
          window.history.replaceState(null, '', reviewApprovalId
            ? CALLBACK + '?approval_request_id=' + encodeURIComponent(reviewApprovalId) : CALLBACK);
          return;
        }
        if (params.has('code') && params.has('state')) {
          const callback = await c.handleRedirectCallback();
          if (isStepUpIntent(callback.appState)) {
            stepUpIntent = callback.appState;
            if (callback.appState.kind === 'approve') reviewApprovalId = callback.appState.approvalRequestId;
          }
          if (isReviewIntent(callback.appState)) reviewApprovalId = callback.appState.approvalRequestId;
          // An exact request ID is not a credential. Retain it in the URL so
          // an Android tab/app reload does not lose the pending work.
          window.history.replaceState(null, '', reviewApprovalId
            ? CALLBACK + '?approval_request_id=' + encodeURIComponent(reviewApprovalId) : CALLBACK);
        }
        const authenticated = await c.isAuthenticated();
        setTokenReady(authenticated);
        if (authenticated && reviewApprovalId) {
          setRequestedApprovalId(reviewApprovalId);
          window.history.replaceState(null, '', CALLBACK + '?approval_request_id=' + encodeURIComponent(reviewApprovalId));
        }
        setStatus(authenticated
          ? 'เข้าสู่ระบบ Auth0 แล้ว พร้อมตรวจรายการรออนุมัติ'
          : 'กดเข้าสู่ระบบเพื่อรับสิทธิ์ dsg.approve สำหรับเซสชันนี้');
        if (stepUpIntent) {
          setStatus('Auth0 ยืนยันกลับมาแล้ว กำลังตรวจ signed MFA proof กับ DSG Spacetime');
          setPendingStepUpIntent(stepUpIntent);
        }
      } catch {
        if (live) setStatus('ไม่สามารถยืนยันเซสชันเว็บไซต์ / Auth0 ได้');
      }
    }
    void initialize();
    return () => { live = false; };
  }, []);

  const obtainToken = useCallback(async () => {
    if (!client.current) throw new Error('AUTH0_SESSION_NOT_READY');
    // Reuse the unexpired token issued by the explicit login. Forcing a silent
    // iframe here loses a valid session when third-party cookies are blocked.
    // The SDK renews expired tokens; high-risk MFA below stays interactive.
    return client.current.getTokenSilently({
      authorizationParams: { audience: AUDIENCE, scope: SCOPE },
    });
  }, []);

  const tool = useCallback(async (
    name: string, args: Record<string, unknown>, tokenOverride?: string,
  ): Promise<ToolResponse> => {
    const accessToken = tokenOverride ?? await obtainToken();
    if (!accessToken) throw new Error('AUTH0_APPROVER_TOKEN_REQUIRED');
    const res = await fetch('/api/dsg/spacetime/user-tools', {
      method: 'POST', credentials: 'include', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: name, arguments: args, accessToken }),
    });
    const payload = await res.json() as ToolResponse;
    if (!res.ok || !payload.ok) throw new Error(payload.error || payload.receipt?.reason || 'MCP_REJECTED');
    return payload;
  }, [obtainToken]);

  // Read-only discovery after explicit Auth0 login. Previously users saw an
  // empty queue until pressing a second button, which looked like approval was
  // unavailable. Never auto-approve, step up MFA, or fetch a different user's
  // requests.
  useEffect(() => {
    if (!tokenReady || requestedApprovalId || pendingStepUpIntent || initialListLoaded.current) return;
    initialListLoaded.current = true;
    let active = true;
    void tool('spacetime_list_pending_approvals', {}).then((data) => {
      if (!active) return;
      const items = Array.isArray(data.receipt?.approvals) ? data.receipt.approvals : [];
      setApprovals(items);
      setStatus(items.length
        ? 'โหลดคำขอจาก AWS Spacetime แล้ว โปรดตรวจรายละเอียดก่อนอนุมัติ'
        : 'ไม่พบคำขอที่รออนุมัติในบัญชี Auth0 นี้ — ตรวจบัญชีผู้ขอหรือเวลาหมดอายุ และเปิดด้วยรหัสคำขอได้');
    }).catch((error) => {
      if (active) setStatus('โหลดคำขออัตโนมัติไม่ได้: ' +
        (error instanceof Error ? error.message : 'APPROVAL_LIST_UNAVAILABLE'));
    });
    return () => { active = false; };
  }, [tokenReady, requestedApprovalId, pendingStepUpIntent, tool]);

  function openExactApproval() {
    const id = manualApprovalId.trim();
    if (!isValidApprovalRequestId(id)) {
      setStatus('รหัสคำขอไม่ถูกต้อง กรุณาคัดลอก approval_request_id จากข้อความ DSG');
      return;
    }
    // The request id is not a credential. Preserve it across Auth0 redirects.
    window.history.replaceState(null, '', CALLBACK + '?approval_request_id=' + encodeURIComponent(id));
    reviewedApprovalId.current = null;
    setRequestedApprovalId(id);
    setSelected(null);
    setStatus(tokenReady
      ? 'กำลังเปิดรายละเอียดคำขอ ' + id
      : 'บันทึกรหัสคำขอไว้ใน URL แล้ว โปรดเข้าสู่ระบบ Auth0 เพื่อดูรายละเอียด');
  }

  // A Workroom handoff may point to one exact request. Load that request
  // after the approver session is ready, but never approve it automatically.
  useEffect(() => {
    if (!tokenReady || !requestedApprovalId || reviewedApprovalId.current === requestedApprovalId) return;
    reviewedApprovalId.current = requestedApprovalId;
    let live = true;
    setBusy(true);
    void tool('spacetime_get_approval', {
      approval_request_id: requestedApprovalId,
    }).then((data) => {
      const approval = data.receipt?.approval;
      if (!approval || approval.approval_request_id !== requestedApprovalId) {
        throw new Error('APPROVAL_REQUEST_NOT_RELOADED');
      }
      if (!live) return;
      setSelected(approval);
      setApprovals(items => items.some(item => item.approval_request_id === approval.approval_request_id)
        ? items : [approval, ...items]);
      setStatus('เปิดคำขอที่ระบุแล้ว โปรดตรวจ payload และกดอนุมัติด้วยตนเอง');
    }).catch((error) => {
      if (live) setStatus('เปิดคำขอไม่ได้: ' + (error instanceof Error ? error.message : 'APPROVAL_NOT_FOUND'));
    }).finally(() => {
      if (live) setBusy(false);
    });
    return () => { live = false; };
  }, [requestedApprovalId, tokenReady, tool]);

  async function login() {
    if (!client.current) return;
    setBusy(true);
    try {
      const queryApprovalId = new URLSearchParams(window.location.search).get('approval_request_id');
      const appState = isValidApprovalRequestId(queryApprovalId)
        ? { kind: 'review' as const, approvalRequestId: queryApprovalId }
        : undefined;
      await client.current.loginWithRedirect({
        authorizationParams: { redirect_uri: CALLBACK, audience: AUDIENCE, scope: SCOPE },
        ...(appState ? { appState } : {}),
      });
    } catch {
      setStatus('AUTH0_REDIRECT_FAILED — ตรวจ Allowed Callback URLs และ dsg.approve');
      setBusy(false);
    }
  }

  async function startStepUp(intent: StepUpIntent) {
    if (!client.current || !authReady) return;
    setBusy(true);
    setStatus(intent.kind === 'approve'
      ? 'กำลังเปิด Auth0 ยืนยัน MFA ก่อนอนุมัติ (จะกลับมาหน้านี้อัตโนมัติ)'
      : 'กำลังเปิด Auth0 ยืนยัน MFA (ทดสอบอย่างเดียว ไม่อนุมัติงาน)');
    try {
      // A normal interactive redirect is sufficient: the dedicated Auth0
      // Post-Login Action challenges for a fresh OTP when ext_dsg_stepup=1.
      // Do not force a second primary sign-in with prompt=login/max_age=0.
      // Auth0 state contains only the intent and exact request ID.
      await client.current.loginWithRedirect({
        authorizationParams: {
          redirect_uri: CALLBACK,
          audience: AUDIENCE,
          scope: SCOPE,
          ext_dsg_stepup: '1',
        },
        appState: intent,
      });
    } catch (error) {
      setStatus('MFA NOT STARTED — ' + (error instanceof Error ? error.message : 'AUTH0_FAILED'));
      setBusy(false);
    }
  }

  const finishStepUp = useCallback(async (intent: StepUpIntent) => {
    const key = intent.kind === 'approve' ? intent.approvalRequestId : 'mfa_probe';
    if (completingStepUpId.current === key) return;
    completingStepUpId.current = key;
    setPendingStepUpIntent(null);
    setBusy(true);
    try {
      if (!client.current) throw new Error('AUTH0_SESSION_NOT_READY');
      // handleRedirectCallback stores the token from the exact step-up
      // transaction in the SDK's in-memory cache. Reuse that token; a new
      // silent transaction would lose the MFA challenge context.
      const token = await client.current.getTokenSilently({
        authorizationParams: { audience: AUDIENCE, scope: SCOPE },
      });
      if (!token) throw Error('AUTH0_MFA_ACCESS_TOKEN_REQUIRED');

      if (intent.kind === 'mfa_probe') {
        const response = await fetch('/api/dsg/approvals/mfa-check', {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: token }),
        });
        const receipt = await response.json() as {
          ok?: boolean; mfaVerified?: boolean; error?: string;
        };
        if (!response.ok || receipt.ok !== true || receipt.mfaVerified !== true) {
          throw Error(receipt.error || 'MFA_PROOF_NOT_VERIFIED');
        }
        setStatus('MFA VERIFIED — signed proof ผ่านแล้ว (ยังไม่ได้อนุมัติหรือ Execute งาน)');
        return;
      }

      const details = await tool('spacetime_get_approval', {
        approval_request_id: intent.approvalRequestId,
      }, token);
      if (details.receipt?.approval?.approval_request_id !== intent.approvalRequestId) {
        throw Error('APPROVAL_REQUEST_NOT_RELOADED');
      }
      const data = await tool('spacetime_resolve_approval', {
        approval_request_id: intent.approvalRequestId, decision: 'APPROVE',
      }, token);
      if (data.receipt?.verdict !== 'APPROVED') {
        throw Error(data.receipt?.reason || 'APPROVAL_RESULT_NOT_VERIFIED');
      }
      setStatus('APPROVED — ผู้ขออนุมัติต้อง claim permit และส่งหลักฐาน Execute กลับมา');
      setSelected(null);
      setApprovals(items => items.filter(item => item.approval_request_id !== intent.approvalRequestId));
    } catch (error) {
      setStatus('MFA NOT VERIFIED — ' + (error instanceof Error ? error.message : 'AUTH0_FAILED'));
    } finally {
      setBusy(false);
      completingStepUpId.current = null;
    }
  }, [tool]);

  useEffect(() => {
    if (!pendingStepUpIntent) return;
    const timer = window.setTimeout(() => {
      void finishStepUp(pendingStepUpIntent);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pendingStepUpIntent, finishStepUp]);

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
    if (decision === 'APPROVE' && (!knownRiskTier(selected.risk_tier) ||
        !selected.route_id || !selected.plan_hash || !selected.subject_hash ||
        !selected.payload || !selected.expires_at)) {
      setStatus('BLOCKED: รายละเอียดงานหรือระดับความเสี่ยงไม่ครบ ห้ามอนุมัติโดยไม่เห็นสิ่งที่ผูกไว้');
      return;
    }
    if (decision === 'APPROVE' && selected.expires_at) {
      const expiry = Date.parse(selected.expires_at);
      if (Number.isFinite(expiry) && expiry <= Date.now()) {
        setStatus('APPROVAL_EXPIRED — คำขอหมดอายุแล้ว ต้องสร้างคำขอใหม่ที่ผูกกับ Plan และ Payload เดิม');
        return;
      }
    }
    setBusy(true);
    try {
      // Reuse a genuine, *fresh*, independently verified signed MFA event
      // during the server's 120-second validity window. This avoids forcing
      // another login/OTP for each exact request; it never skips MFA when stale.
      if (decision === 'APPROVE' && selected.risk_tier === 'high') {
        const token = await obtainToken();
        const proofResponse = await fetch('/api/dsg/approvals/mfa-check', {
          method: 'POST', credentials: 'include', cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: token }),
        });
        const proof = await proofResponse.json() as {
          ok?: boolean; mfaVerified?: boolean; error?: string;
        };
        if (!proofResponse.ok && proofResponse.status === 403 &&
            proof.error === 'FRESH_SIGNED_MFA_REQUIRED') {
          await startStepUp({ kind: 'approve', approvalRequestId: selected.approval_request_id });
          return;
        }
        if (!proofResponse.ok || proof.ok !== true || proof.mfaVerified !== true) {
          throw new Error(proof.error || 'MFA_PROOF_CHECK_FAILED');
        }
        // Still resolve ONE exact request; the prior MFA event does not
        // authorize any other action and is reverified by AWS.
        const data = await tool('spacetime_resolve_approval', {
          approval_request_id: selected.approval_request_id, decision,
        }, token);
        if (data.receipt?.verdict !== 'APPROVED') {
          throw new Error(data.receipt?.reason || 'APPROVAL_RESULT_NOT_VERIFIED');
        }
        setStatus('APPROVED — Signed MFA ยังมีผล ไม่ต้องยืนยันซ้ำ; ผู้ขออนุมัติ Claim แล้ว Execute ได้');
        setSelected(null);
        setApprovals(items => items.filter(item => item.approval_request_id !== selected.approval_request_id));
        return;
      }
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
        <p className="text-sm text-slate-300">ใช้บัญชี Auth0 ของคุณเพื่ออนุมัติผ่าน AWS Spacetime โดยตรง ไม่ต้องเข้าสู่ระบบเว็บไซต์ซ้ำและไม่ใช้ Owner key หรือ internal key</p>
        <p role="status" aria-live="polite" className="rounded-lg border border-slate-700 p-3 text-sm">{status}</p>
        <div className="flex flex-wrap gap-2">
          {!tokenReady && <button type="button" onClick={() => void login()} disabled={!authReady || busy}
            className="rounded-lg bg-indigo-600 px-4 py-2 disabled:opacity-40">เข้าสู่ระบบเพื่ออนุมัติ</button>}
          {/* MFA diagnostics are not part of ordinary approval UX. The signed
              proof is checked automatically on the actual approval tap. */}
          <button type="button" onClick={() => void load()} disabled={!authReady || !tokenReady || busy}
            className="rounded-lg border border-slate-500 px-4 py-2 disabled:opacity-40">ดูรายการรออนุมัติ</button>
          <a href="/dsg/autonomous-level" className="rounded-lg border border-slate-500 px-4 py-2">กลับหน้าสถานะระบบ</a>
        </div>
        <form onSubmit={event => { event.preventDefault(); openExactApproval(); }}
          className="space-y-2 rounded-xl border border-slate-700 bg-slate-950 p-3">
          <label htmlFor="exact-approval-request-id" className="block text-sm font-semibold">
            มีรหัสคำขอจากแชท? เปิดงานนั้นโดยตรง
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input id="exact-approval-request-id" type="text" autoComplete="off"
              value={manualApprovalId} onChange={event => setManualApprovalId(event.target.value)}
              placeholder="dsg_apreq_…" maxLength={192}
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 text-sm text-white"
            />
            <button type="submit" disabled={busy}
              className="min-h-11 rounded-lg border border-indigo-500 px-4 text-sm font-semibold disabled:opacity-40">
              เปิดคำขอ
            </button>
          </div>
          <p className="text-xs text-slate-400">
            ไม่พบรายการอาจเกิดจากคำขอหมดอายุ หรือเข้าสู่ระบบ Auth0 คนละบัญชีกับผู้ขอ
            หน้านี้ไม่สามารถข้าม MFA หรืออนุมัติแทนเจ้าของได้
          </p>
        </form>
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
              <button type="button" disabled={busy || !knownRiskTier(selected.risk_tier)}
                onClick={() => void decide('APPROVE')}
                className="rounded-lg bg-emerald-700 px-4 py-2 disabled:opacity-40">อนุมัติงานนี้</button>
              <button type="button" disabled={busy} onClick={() => void decide('REJECT')}
                className="rounded-lg bg-rose-700 px-4 py-2 disabled:opacity-40">ปฏิเสธ</button>
            </div>
            {selected.risk_tier === 'high' && <p className="text-amber-200 text-sm">งาน High Risk จะเปิด Auth0 ให้ยืนยันตัวตนซ้ำ และจะอนุมัติได้ต่อเมื่อ Spacetime ตรวจหลักฐานยืนยันตัวตนจาก Token ที่ลงลายเซ็นจริงแล้วเท่านั้น</p>}
            {!knownRiskTier(selected.risk_tier) && <p className="text-rose-200 text-sm">BLOCKED: ไม่พบระดับความเสี่ยงที่ตรวจสอบได้</p>}
          </section>
        )}
      </section>
    </main>
  );
}
