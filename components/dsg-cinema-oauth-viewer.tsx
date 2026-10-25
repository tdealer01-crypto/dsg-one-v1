'use client';

import { useRef, useState } from 'react';
import { getDsgBrowserSession } from '@/lib/dsg/user-bound/browser-session';
import { resolveCinemaViewerUrl } from '@/lib/dsg/user-bound/cinema-viewer-session';

const CINEMA_ORIGIN = 'https://aws.dsg.pics';
type Reply = { ok?: boolean; linked?: boolean; connected?: boolean; provider?: string;
  browser_session_id?: string; embed_url?: string; account?: { plan?: string };
  detail?: string | { error?: string }; error?: string };

export function describeCinemaAccountIssue(reason: string): string {
  switch (reason) {
    case 'CINEMA_FREE_ACCOUNT_NOT_LINKED':
      return 'เข้าสู่ระบบ DSG ONE แล้ว แต่ยังไม่ผูกบัญชี Cinema Free เดิม — ยืนยันบัญชีเดิมครั้งเดียวด้านล่าง ไม่ต้องล็อกอิน Google ซ้ำ';
    case 'SAME_ACCOUNT_BROWSER_VIEWER_NOT_READY':
      return 'Shared Browser ของบัญชีนี้ยังไม่พร้อม โปรดตรวจ Remote ON และบัญชีที่ผูกอยู่ก่อน ไม่สร้างโปรไฟล์ใหม่';
    case 'CINEMA_VIEWER_SESSION_MISMATCH':
      return 'Viewer กับ Agent อยู่คนละเซสชัน จึงยังไม่เปิดหน้าต่างเข้าสู่ระบบ ต้องแก้การผูก Cinema ของบัญชีนี้ให้ตรงกันก่อน';
    case 'BROWSER_POPUP_BLOCKED':
      return 'เบราว์เซอร์บล็อกหน้าต่าง Viewer โปรดอนุญาตป๊อปอัปสำหรับ DSG ONE แล้วกดเปิดอีกครั้ง';
    case 'AUTH0_REAUTH_REQUIRED':
    case 'AUTH0_TOKEN_UNAVAILABLE':
      return 'DSG Auth0 session ไม่มี token ที่ใช้ได้ ต้องเข้าสู่ระบบใหม่จาก Workroom เพียงครั้งเดียว';
    case 'SITE_MEMBERSHIP_OR_SIGNER_UNAVAILABLE':
    case 'SITE_IDENTITY_PROOF_NOT_READY':
      return 'เว็บไซต์ออกหลักฐานยืนยัน Workspace ที่ลงลายเซ็นไม่ได้ ต้องตรวจ Identity Link / Signing Key ไม่ใช่ลองล็อกอิน Google ซ้ำ';
    default:
      return reason;
  }
}

async function callCinema(path: '/status' | '/link' | '/viewer', oldFreeKey?: string): Promise<Reply> {
  const token = await getDsgBrowserSession().getTokenSilently();
  const issuerResponse = await fetch('/api/dsg/cinema/free-link-proof', {
    method: 'POST', credentials: 'include', cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken: token }),
  });
  const issuer = await issuerResponse.json() as { assertion?: string; error?: string };
  if (!issuerResponse.ok || !issuer.assertion) {
    throw new Error(issuer.error || 'SITE_IDENTITY_PROOF_NOT_READY');
  }
  const headers: Record<string, string> = {
    Authorization: 'Bearer ' + token,
    'X-DSG-Site-Assertion': issuer.assertion,
  };
  if (oldFreeKey) headers['X-DSG-API-Key'] = oldFreeKey;
  const response = await fetch(CINEMA_ORIGIN + '/remote-browser/oauth' + path, {
    method: path === '/link' ? 'POST' : 'GET', mode: 'cors',
    credentials: 'omit', cache: 'no-store', headers,
  });
  const body = await response.json() as Reply;
  if (!response.ok || body.ok !== true) {
    const error = typeof body.detail === 'object' ? body.detail.error : body.detail;
    throw new Error(error || body.error || 'CINEMA_FREE_LINK_NOT_READY');
  }
  return body;
}

export function DsgCinemaOauthViewer({ ready, readGovernedStatus, onWorkingChange }: {
  ready: boolean;
  readGovernedStatus: () => Promise<unknown>;
  onWorkingChange: (working: boolean) => void;
}) {
  const [working, setWorking] = useState(false);
  const workingRef = useRef(false);
  const [linked, setLinked] = useState(false);
  const [message, setMessage] = useState('');
  const [existingKey, setExistingKey] = useState('');

  function begin() {
    if (!ready || workingRef.current) return false;
    workingRef.current = true;
    setWorking(true);
    onWorkingChange(true);
    return true;
  }

  function finish() {
    workingRef.current = false;
    setWorking(false);
    onWorkingChange(false);
  }

  async function checkLink() {
    if (!begin()) return;
    try {
      const status = await callCinema('/status');
      const verifiedFreeLink = status.linked === true && status.account?.plan === 'free';
      setLinked(verifiedFreeLink);
      setMessage(verifiedFreeLink
        ? 'ยืนยันบัญชี Free เดิมแล้ว ใช้ Auth0 เปิด Viewer ของบัญชีนี้ได้'
        : describeCinemaAccountIssue('CINEMA_FREE_ACCOUNT_NOT_LINKED'));
    } catch (error) {
      setLinked(false);
      setMessage(describeCinemaAccountIssue(error instanceof Error ? error.message : 'ACCOUNT_LINK_UNVERIFIED'));
    } finally {
      finish();
    }
  }

  async function linkOnce() {
    const proof = existingKey.trim();
    if (!proof || !begin()) return;
    setExistingKey('');
    try {
      const result = await callCinema('/link', proof);
      setLinked(result.linked === true);
      setMessage(result.linked === true
        ? 'ยืนยันและผูกบัญชี Free เดิมแล้ว'
        : describeCinemaAccountIssue('CINEMA_FREE_ACCOUNT_NOT_LINKED'));
    } catch (error) {
      setMessage(describeCinemaAccountIssue(error instanceof Error ? error.message : 'ACCOUNT_LINK_FAILED'));
    } finally {
      finish();
    }
  }

  async function openViewer() {
    if (!begin()) return;
    // Open during the click before awaited network calls to avoid popup blocking.
    let tab: Window | null = null;
    try {
      try { tab = window.open('about:blank', '_blank'); }
      catch { throw new Error('BROWSER_POPUP_BLOCKED'); }
      if (!tab) throw new Error('BROWSER_POPUP_BLOCKED');
      tab.opener = null;
      const viewerUrl = await resolveCinemaViewerUrl({
        readGovernedStatus,
        readAccountStatus: () => callCinema('/status'),
        readViewer: () => callCinema('/viewer'),
      });
      setLinked(true);
      tab.location.replace(viewerUrl);
      setMessage('เปิด Viewer ที่ตรงกับเซสชัน Agent แล้ว · เข้าสู่ระบบเว็บในหน้าต่างนั้น แล้วกลับมาสั่งงานต่อ');
    } catch (error) {
      tab?.close();
      setMessage(describeCinemaAccountIssue(error instanceof Error ? error.message : 'HUMAN_VIEWER_UNAVAILABLE'));
    } finally {
      finish();
    }
  }

  return (
    <section aria-label="Cinema Free Auth0 Viewer" className="rounded-xl border border-indigo-500/30 bg-slate-950 p-4">
      <h3 className="font-semibold">Cinema Shared Browser · Auth0</h3>
      <p className="my-2 text-sm text-slate-300">
        ใช้บัญชี DSG ONE เดิม ไม่ต้องกรอก API Key ทุกครั้งหลังผูกบัญชี Free แล้ว
        การเข้าถึงของ Agent ยังคงต้องผ่าน Plan และ Approval
      </p>
      <div className="flex flex-wrap gap-2">
        <button disabled={!ready || working} type="button" onClick={() => void checkLink()}
          className="rounded-lg border border-slate-600 px-3 py-2 disabled:opacity-40">
          ตรวจบัญชี Free
        </button>
        <button disabled={!ready || working} type="button" onClick={() => void openViewer()}
          className="rounded-lg bg-indigo-700 px-3 py-2 disabled:opacity-40">
          เปิด Shared Browser ของฉัน
        </button>
      </div>
      <p role="status" className="mt-2 break-words text-xs text-slate-300">
        {message || 'กดเปิด Shared Browser ได้เลย ระบบจะตรวจบัญชีและเซสชัน Agent ให้ในครั้งเดียว'}
      </p>
      {!linked && <details className="mt-3 border-t border-slate-700 pt-3">
        <summary className="cursor-pointer text-sm">พิสูจน์บัญชี Cinema Free เดิมครั้งแรก (ขั้นสูง)</summary>
        <p className="my-2 text-xs text-slate-400">
          ต้องยืนยันสิทธิ์บัญชีเดิมครั้งเดียว ระบบไม่สร้างบัญชี Free ซ้ำหรือยึดบัญชีอื่นอัตโนมัติ
        </p>
        <label htmlFor="cinema-old-free-key" className="block text-sm">คีย์บัญชี Free เดิม (ใช้ครั้งเดียว)</label>
        <input id="cinema-old-free-key" type="password" autoComplete="off"
          value={existingKey} onChange={event => setExistingKey(event.target.value)}
          className="mt-1 w-full rounded-lg bg-slate-900 p-3 text-sm" />
        <button disabled={!ready || working || !existingKey.trim()} type="button"
          onClick={() => void linkOnce()}
          className="mt-2 rounded-lg border border-slate-600 px-3 py-2 disabled:opacity-40">
          ยืนยันบัญชี Free เดิม
        </button>
      </details>}
    </section>
  );
}
