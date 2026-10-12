'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCircle2, XCircle, ShieldAlert, Clock, RefreshCw } from 'lucide-react';
import { formatRelativeTime } from '@/lib/dsg/ui/format';

type NotificationType = 'BUILD_COMPLETE' | 'BUILD_FAILED' | 'GOVERNANCE' | 'APPROVAL' | 'SYSTEM';

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
};

type FilterTab = 'ALL' | 'UNREAD' | 'BUILDS' | 'GOVERNANCE' | 'SYSTEM';
type LoadState = 'loading' | 'ready' | 'error';

type ListResponse = { ok?: boolean; data?: { items: Notification[]; total: number; unreadCount: number; perPage?: number } };

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'ALL', label: 'ทั้งหมด' },
  { id: 'UNREAD', label: 'ยังไม่อ่าน' },
  { id: 'BUILDS', label: 'Builds' },
  { id: 'GOVERNANCE', label: 'Governance' },
  { id: 'SYSTEM', label: 'System' },
];

const TYPE_LABEL: Record<NotificationType, string> = {
  BUILD_COMPLETE: 'Build สำเร็จ',
  BUILD_FAILED: 'Build ล้มเหลว',
  GOVERNANCE: 'Governance',
  APPROVAL: 'ขออนุมัติ',
  SYSTEM: 'ระบบ',
};

function typeLabel(type: string): string {
  return TYPE_LABEL[type as NotificationType] ?? type;
}

function NotifIcon({ type }: { type: string }) {
  switch (type) {
    case 'BUILD_COMPLETE': return <CheckCircle2 className="h-5 w-5 text-emerald-400" aria-hidden="true" />;
    case 'BUILD_FAILED': return <XCircle className="h-5 w-5 text-red-500" aria-hidden="true" />;
    case 'GOVERNANCE': return <ShieldAlert className="h-5 w-5 text-amber-400" aria-hidden="true" />;
    case 'APPROVAL': return <Clock className="h-5 w-5 text-indigo-400" aria-hidden="true" />;
    default: return <Bell className="h-5 w-5 text-slate-400" aria-hidden="true" />;
  }
}

function httpFailure(what: string, status: number | null): string {
  return status === null
    ? `${what}ไม่สำเร็จ — เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบเครือข่ายแล้วลองอีกครั้ง`
    : `${what}ไม่สำเร็จ (HTTP ${status}) — ลองอีกครั้ง หากยังไม่ได้ให้เข้าสู่ระบบใหม่`;
}

export default function NotificationsPage() {
  const [filter, setFilter] = useState<FilterTab>('ALL');
  const [items, setItems] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [page, setPage] = useState(1);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(0);

  const load = useCallback(async (tab: FilterTab, nextPage: number) => {
    setState('loading');
    setError('');
    try {
      const response = await fetch(`/api/dsg/notifications?filter=${tab}&page=${nextPage}`, { cache: 'no-store', credentials: 'include' });
      if (response.status === 401) {
        window.location.assign('/login?next=/dsg/notifications');
        return;
      }
      const body = await response.json().catch(() => null) as ListResponse | null;
      if (!response.ok || !body?.ok || !body.data) {
        setError(httpFailure('โหลดการแจ้งเตือน', response.ok ? 502 : response.status));
        setState('error');
        return;
      }
      const data = body.data;
      setItems((previous) => (nextPage === 1 ? data.items : [...previous, ...data.items]));
      setTotal(data.total);
      setUnread(data.unreadCount);
      setPage(nextPage);
      setFetchedAt(Date.now());
      setState('ready');
    } catch {
      setError(httpFailure('โหลดการแจ้งเตือน', null));
      setState('error');
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load('ALL', 1), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const changeTab = (tab: FilterTab) => {
    setFilter(tab);
    setItems([]);
    setActionError('');
    void load(tab, 1);
  };

  const patch = async (payload: { id: string } | { markAll: true }): Promise<boolean> => {
    setBusy(true);
    setActionError('');
    try {
      const response = await fetch('/api/dsg/notifications', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (response.status === 401) {
        window.location.assign('/login?next=/dsg/notifications');
        return false;
      }
      if (!response.ok) {
        setActionError(httpFailure('ทำเครื่องหมายว่าอ่านแล้ว', response.status));
        return false;
      }
      return true;
    } catch {
      setActionError(httpFailure('ทำเครื่องหมายว่าอ่านแล้ว', null));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const markRead = async (id: string) => {
    if (!(await patch({ id }))) return;
    setItems((previous) => previous.map((item) => (item.id === id ? { ...item, read: true } : item)));
    setUnread((count) => Math.max(0, count - 1));
  };

  const markAllRead = async () => {
    if (await patch({ markAll: true })) await load(filter, 1);
  };

  const hasMore = items.length < total;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 md:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600">
              <Bell className="h-5 w-5 text-white" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Notifications</h1>
              <p className="text-sm text-slate-300" role="status">{state === 'loading' && items.length === 0 ? 'กำลังโหลด…' : state === 'error' ? 'โหลดไม่สำเร็จ' : `ยังไม่ได้อ่าน ${unread} รายการ`}</p>
            </div>
          </div>
          {unread > 0 ? (
            <button type="button" onClick={() => void markAllRead()} disabled={busy} className="min-h-11 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-60">
              ทำเครื่องหมายว่าอ่านทั้งหมด
            </button>
          ) : null}
        </header>

        <div role="group" aria-label="กรองการแจ้งเตือน" className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900 p-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={filter === tab.id}
              onClick={() => changeTab(tab.id)}
              className={`min-h-11 shrink-0 rounded-xl px-4 py-2 text-sm font-bold transition ${filter === tab.id ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {actionError ? <p role="alert" className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">{actionError}</p> : null}

        {state === 'error' ? (
          <div role="alert" className="flex flex-col gap-3 rounded-3xl border border-amber-500/40 bg-amber-500/10 p-5 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <button type="button" onClick={() => void load(filter, 1)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-400/50 px-4 py-2 font-bold hover:bg-amber-500/10">
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> ลองอีกครั้ง
            </button>
          </div>
        ) : null}

        {state === 'ready' && items.length === 0 ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center">
            <Bell className="mx-auto h-10 w-10 text-slate-500" aria-hidden="true" />
            <p className="mt-4 text-lg font-bold text-slate-200">{filter === 'ALL' ? 'ยังไม่มีการแจ้งเตือน' : 'ไม่มีรายการในหมวดนี้'}</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              ตอนนี้ระบบยังไม่ได้สร้างการแจ้งเตือนให้บัญชีนี้ — รายการที่รอคุณตัดสินใจอยู่ที่หน้าอนุมัติ และผลการ build อยู่ที่ประวัติ
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <a href="/dsg/approvals" className="inline-flex min-h-11 items-center rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold text-indigo-300 hover:border-slate-500">ไปหน้าอนุมัติ</a>
              <a href="/dsg/history" className="inline-flex min-h-11 items-center rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold text-indigo-300 hover:border-slate-500">ดูประวัติ build</a>
            </div>
          </div>
        ) : null}

        {items.length > 0 ? (
          <ol className="space-y-2">
            {items.map((notif) => (
              <li key={notif.id} className={`relative overflow-hidden rounded-3xl border bg-slate-900 p-5 ${notif.read ? 'border-slate-800/60' : 'border-indigo-500/40'}`}>
                {!notif.read ? <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-indigo-500" /> : null}
                <div className="flex items-start gap-3 pl-1">
                  <span className="mt-0.5 shrink-0"><NotifIcon type={notif.type} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className={`text-sm font-bold leading-5 ${notif.read ? 'text-slate-300' : 'text-slate-100'}`}>
                        <span className="mr-2 rounded-full border border-slate-600 px-2 py-0.5 text-[11px] font-bold text-slate-300">{typeLabel(notif.type)}</span>
                        {notif.title}
                      </p>
                      <time dateTime={notif.timestamp} className="shrink-0 text-xs text-slate-400">{formatRelativeTime(notif.timestamp, fetchedAt)}</time>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-300">{notif.body}</p>
                    {!notif.read ? (
                      <button type="button" onClick={() => void markRead(notif.id)} disabled={busy} className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-slate-700 px-4 py-2 text-xs font-bold text-slate-200 hover:border-slate-500 disabled:opacity-60">
                        ทำเครื่องหมายว่าอ่านแล้ว
                      </button>
                    ) : (
                      <p className="mt-2 text-xs text-slate-400">อ่านแล้ว</p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : null}

        {state === 'loading' && items.length > 0 ? <p role="status" className="text-center text-sm text-slate-400">กำลังโหลด…</p> : null}

        {state === 'ready' && hasMore ? (
          <div className="flex justify-center">
            <button type="button" onClick={() => void load(filter, page + 1)} className="min-h-11 rounded-2xl border border-slate-700 px-6 py-3 text-sm font-bold text-slate-200 hover:bg-slate-800">
              โหลดเพิ่ม ({items.length}/{total})
            </button>
          </div>
        ) : null}

        <p className="text-center text-xs text-slate-400">
          การตั้งค่าส่งอีเมล/Slack ยังไม่เปิดให้ใช้ — ระบบยังไม่มีตัวส่งการแจ้งเตือนภายนอก จึงไม่แสดงสวิตช์ที่ไม่ทำงานจริง
        </p>
      </div>
    </main>
  );
}
