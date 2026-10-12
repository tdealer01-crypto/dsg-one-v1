'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  GitCompare,
  History,
  Minus,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
} from 'lucide-react';
import { StatusBadge } from '@/components/status-badge';
import { formatRelativeTime } from '@/lib/dsg/ui/format';
import { toStatusTone } from '@/lib/dsg/ui/status';
import type { BuildEntry, BuildStatus } from '@/app/api/dsg/history/route';

const STATUS_FILTERS = ['ALL', 'DEPLOYED', 'BUILDING', 'FAILED', 'DRAFT'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_LABEL: Record<StatusFilter, string> = {
  ALL: 'ทุกสถานะ',
  DEPLOYED: 'ใช้งานแล้ว',
  BUILDING: 'กำลังสร้าง',
  FAILED: 'ล้มเหลว',
  DRAFT: 'ฉบับร่าง',
};

const SEARCH_DEBOUNCE_MS = 300;
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400';

type HistoryData = { items: BuildEntry[]; total: number; page: number; totalPages: number };
type Outcome =
  | { kind: 'ready'; data: HistoryData }
  | { kind: 'error'; reason: 'auth' | 'server' | 'network'; httpStatus: number | null };
type CompareState = { a: BuildEntry; b: BuildEntry | null };

function statusLabel(status: BuildStatus): string {
  return STATUS_LABEL[status] ?? status;
}

function timelineDotClass(status: string): string {
  switch (toStatusTone(status)) {
    case 'pass': return 'border-emerald-500 bg-emerald-500/20';
    case 'fail': return 'border-red-500 bg-red-500/20';
    case 'pending': return 'border-sky-500 bg-sky-500/20';
    default: return 'border-slate-600 bg-slate-800';
  }
}

const shortId = (entry: BuildEntry) => `#${entry.id.slice(0, 8)}`;

export default function BuildHistoryPage() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [page, setPage] = useState(1);
  const [reloadCount, setReloadCount] = useState(0);
  const [result, setResult] = useState<{ key: string; outcome: Outcome; fetchedAt: number } | null>(null);
  const [compare, setCompare] = useState<CompareState | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A result only counts for the request that produced it; any change of filter/page/retry
  // makes `loading` true again without setting state inside the effect.
  const requestKey = `${page}|${statusFilter}|${query}|${reloadCount}`;
  const loading = result?.key !== requestKey;

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), status: statusFilter });
    if (query) params.set('search', query);
    const settle = (outcome: Outcome) => {
      if (!controller.signal.aborted) setResult({ key: requestKey, outcome, fetchedAt: Date.now() });
    };

    fetch(`/api/dsg/history?${params.toString()}`, {
      cache: 'no-store',
      credentials: 'include',
      signal: controller.signal,
    })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          settle({ kind: 'error', reason: 'auth', httpStatus: res.status });
          return;
        }
        const body = (await res.json().catch(() => null)) as { ok?: boolean; data?: HistoryData } | null;
        if (!res.ok || !body?.ok || !body.data) {
          settle({ kind: 'error', reason: 'server', httpStatus: res.status });
          return;
        }
        settle({ kind: 'ready', data: body.data });
      })
      .catch(() => settle({ kind: 'error', reason: 'network', httpStatus: null }));

    return () => controller.abort();
  }, [page, statusFilter, query, requestKey]);

  useEffect(() => () => {
    if (debounce.current) clearTimeout(debounce.current);
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setQuery(value.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  const handleStatusChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value as StatusFilter);
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    if (debounce.current) clearTimeout(debounce.current);
    setSearch('');
    setQuery('');
    setStatusFilter('ALL');
    setPage(1);
  }, []);

  const handleCompare = useCallback((entry: BuildEntry) => {
    setCompare((prev) => {
      if (!prev) return { a: entry, b: null };
      if (prev.a.id === entry.id) return null;
      return { a: prev.a, b: entry };
    });
  }, []);

  const dismissCompare = useCallback(() => setCompare(null), []);
  const retry = useCallback(() => setReloadCount((n) => n + 1), []);

  const outcome = loading ? null : result?.outcome ?? null;
  const data = outcome?.kind === 'ready' ? outcome.data : null;
  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const filtersActive = query !== '' || statusFilter !== 'ALL';
  const now = result?.fetchedAt ?? 0;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">

        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600">
              <History className="h-5 w-5 text-white" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">ประวัติการสร้างแอป</h1>
              <p className="text-sm text-slate-400">ทุกเวอร์ชันของแอปที่คุณสร้าง (ข้อมูลจริงจากบัญชีของคุณ)</p>
            </div>
          </div>
          {data && (
            <span className="self-start rounded-full border border-slate-700 px-3 py-1 text-xs font-bold text-slate-300 sm:self-auto">
              {data.total} รายการ
            </span>
          )}
        </header>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={handleSearchChange}
              aria-label="ค้นหาตามชื่อแอปหรือสรุปการเปลี่ยนแปลง"
              placeholder="ค้นหาตามชื่อแอปหรือสรุปการเปลี่ยนแปลง…"
              className={`min-h-11 w-full rounded-2xl border border-slate-800 bg-slate-900 py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 ${FOCUS}`}
            />
          </div>
          <select
            value={statusFilter}
            onChange={handleStatusChange}
            aria-label="กรองตามสถานะ"
            className={`min-h-11 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 focus:border-indigo-500 ${FOCUS}`}
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>

        <p className="text-xs text-slate-500">
          ปุ่ม “ดู” และ “กู้คืน” ยังปิดอยู่ เพราะยังไม่มีระบบรองรับ — ตอนนี้ใช้ “เปรียบเทียบ” ได้
        </p>

        {compare && (
          <div className="rounded-3xl border border-indigo-500/30 bg-indigo-500/10 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-indigo-200">
                <GitCompare className="h-4 w-4" aria-hidden="true" />
                โหมดเปรียบเทียบ
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-xl border border-indigo-400/30 bg-slate-900 px-3 py-1 font-mono text-indigo-300">{shortId(compare.a)} — {compare.a.appName}</span>
                <span className="text-slate-500">เทียบกับ</span>
                {compare.b ? (
                  <span className="rounded-xl border border-emerald-400/30 bg-slate-900 px-3 py-1 font-mono text-emerald-300">{shortId(compare.b)} — {compare.b.appName}</span>
                ) : (
                  <span className="rounded-xl border border-dashed border-slate-600 px-3 py-1 text-slate-500">เลือกเวอร์ชันที่สองจากรายการด้านล่าง</span>
                )}
              </div>
              {compare.b && (
                <div className="flex items-start gap-4 rounded-2xl border border-slate-700 bg-slate-900 p-3 text-xs">
                  <div>
                    <p className="font-bold text-slate-300">{shortId(compare.a)}</p>
                    <p className="mt-1 text-slate-500">{compare.a.summary}</p>
                    <p className="mt-1 font-mono"><span className="text-emerald-400">+{compare.a.addedLines}</span> <span className="text-red-400">-{compare.a.removedLines}</span></p>
                  </div>
                  <div className="border-l border-slate-700 pl-4">
                    <p className="font-bold text-slate-300">{shortId(compare.b)}</p>
                    <p className="mt-1 text-slate-500">{compare.b.summary}</p>
                    <p className="mt-1 font-mono"><span className="text-emerald-400">+{compare.b.addedLines}</span> <span className="text-red-400">-{compare.b.removedLines}</span></p>
                  </div>
                </div>
              )}
              <button type="button" onClick={dismissCompare} className={`ml-auto min-h-11 rounded-2xl border border-slate-700 px-4 py-1.5 text-xs text-slate-300 hover:bg-slate-800 ${FOCUS}`}>
                ยกเลิก
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div role="status" className="rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-400">
            กำลังโหลดประวัติ…
          </div>
        )}

        {outcome?.kind === 'error' && (
          <div role="alert" className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6">
            {outcome.reason === 'auth' && (
              <>
                <p className="font-bold text-red-200">ต้องเข้าสู่ระบบก่อนดูประวัติ (HTTP {outcome.httpStatus})</p>
                <p className="mt-1 text-sm text-slate-300">เซสชันอาจหมดอายุ หรือบัญชีนี้ยังไม่มีสิทธิ์อ่านประวัติ</p>
                <Link href="/login?next=/dsg/history" className={`mt-4 inline-flex min-h-11 items-center rounded-2xl bg-indigo-600 px-5 text-sm font-bold text-white hover:bg-indigo-500 ${FOCUS}`}>
                  เข้าสู่ระบบ
                </Link>
              </>
            )}
            {outcome.reason === 'server' && (
              <>
                <p className="font-bold text-red-200">โหลดประวัติไม่สำเร็จ (HTTP {outcome.httpStatus})</p>
                <p className="mt-1 text-sm text-slate-300">ฝั่งเซิร์ฟเวอร์ตอบกลับผิดพลาด กดลองใหม่ ถ้ายังเป็นอีกให้แจ้งผู้ดูแลพร้อมรหัส HTTP นี้</p>
              </>
            )}
            {outcome.reason === 'network' && (
              <>
                <p className="font-bold text-red-200">เชื่อมต่อเซิร์ฟเวอร์ไม่ได้</p>
                <p className="mt-1 text-sm text-slate-300">ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่</p>
              </>
            )}
            {outcome.reason !== 'auth' && (
              <button type="button" onClick={retry} className={`mt-4 inline-flex min-h-11 items-center gap-2 rounded-2xl border border-red-400/40 px-5 text-sm font-bold text-red-100 hover:bg-red-500/10 ${FOCUS}`}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> ลองใหม่
              </button>
            )}
          </div>
        )}

        {data && items.length === 0 && (
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-12 text-center">
            <History className="mx-auto h-10 w-10 text-slate-600" aria-hidden="true" />
            {filtersActive ? (
              <>
                <p className="mt-4 text-lg font-bold text-slate-300">ไม่พบรายการที่ตรงกับตัวกรอง</p>
                <button type="button" onClick={clearFilters} className={`mt-6 inline-flex min-h-11 items-center rounded-2xl border border-slate-700 px-5 text-sm font-bold text-slate-200 hover:bg-slate-800 ${FOCUS}`}>
                  ล้างตัวกรอง
                </button>
              </>
            ) : (
              <>
                <p className="mt-4 text-lg font-bold text-slate-300">ยังไม่มีประวัติการสร้างแอป</p>
                <p className="mt-2 text-sm text-slate-500">เริ่มสร้างแอปแรกใน App Builder แล้วทุกเวอร์ชันจะมาแสดงที่นี่</p>
                <Link href="/dsg/app-builder" className={`mt-6 inline-flex min-h-11 items-center rounded-2xl bg-indigo-600 px-5 text-sm font-bold text-white hover:bg-indigo-500 ${FOCUS}`}>
                  เปิด App Builder
                </Link>
              </>
            )}
          </div>
        )}

        {data && items.length > 0 && (
          <div className="relative">
            <div className="absolute left-5 top-0 h-full w-px bg-slate-800 sm:left-7" />
            <ol className="space-y-3">
              {items.map((entry) => {
                const isSelected = compare?.a.id === entry.id || compare?.b?.id === entry.id;
                return (
                  <li key={entry.id} className="relative pl-12 sm:pl-16">
                    <span className={`absolute left-3 top-4 flex h-5 w-5 items-center justify-center rounded-full border-2 sm:left-5 ${timelineDotClass(entry.status)}`} />

                    <article className={`rounded-3xl border bg-slate-900 p-5 transition ${
                      isSelected ? 'border-indigo-500/50 ring-1 ring-indigo-500/30' : 'border-slate-800 hover:border-slate-700'
                    }`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 text-slate-300">
                            <Package className="h-5 w-5" aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-bold text-slate-400">{shortId(entry)}</span>
                              <StatusBadge status={entry.status} label={statusLabel(entry.status)} />
                            </div>
                            <p className="mt-0.5 break-words font-bold text-slate-100">{entry.appName}</p>
                          </div>
                        </div>
                        <time dateTime={entry.timestamp} className="text-xs text-slate-500">
                          {formatRelativeTime(entry.timestamp, now)}
                        </time>
                      </div>

                      {entry.summary && <p className="mt-3 break-words text-sm leading-6 text-slate-300">{entry.summary}</p>}

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3 font-mono text-xs">
                          <span className="flex items-center gap-1 text-emerald-400">
                            <Plus className="h-3 w-3" aria-hidden="true" />{entry.addedLines}
                          </span>
                          <span className="flex items-center gap-1 text-red-400">
                            <Minus className="h-3 w-3" aria-hidden="true" />{entry.removedLines}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled
                            title="ยังไม่เปิดใช้งาน — ยังไม่มีระบบดูตัวอย่างเวอร์ชัน"
                            className="flex min-h-11 cursor-not-allowed items-center gap-1.5 rounded-2xl border border-slate-800 px-3 py-1.5 text-xs font-bold text-slate-600"
                          >
                            <Eye className="h-3.5 w-3.5" aria-hidden="true" /> ดู
                          </button>
                          <button
                            type="button"
                            disabled
                            title="ยังไม่เปิดใช้งาน — ยังไม่มีระบบกู้คืนเวอร์ชัน"
                            className="flex min-h-11 cursor-not-allowed items-center gap-1.5 rounded-2xl border border-slate-800 px-3 py-1.5 text-xs font-bold text-slate-600"
                          >
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> กู้คืน
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCompare(entry)}
                            aria-pressed={isSelected}
                            className={`flex min-h-11 items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-xs font-bold transition ${FOCUS} ${
                              isSelected
                                ? 'border-indigo-500/50 bg-indigo-600/20 text-indigo-300'
                                : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            <GitCompare className="h-3.5 w-3.5" aria-hidden="true" /> เปรียบเทียบ
                          </button>
                        </div>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {data && items.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 rounded-3xl border border-slate-800 bg-slate-900 px-3 py-3 sm:px-5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className={`flex min-h-11 items-center gap-1.5 rounded-2xl border border-slate-700 px-4 py-2 text-sm font-bold text-slate-300 hover:bg-slate-800 disabled:opacity-40 ${FOCUS}`}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" /> ก่อนหน้า
            </button>
            <span className="text-sm text-slate-400">
              หน้า {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className={`flex min-h-11 items-center gap-1.5 rounded-2xl border border-slate-700 px-4 py-2 text-sm font-bold text-slate-300 hover:bg-slate-800 disabled:opacity-40 ${FOCUS}`}
            >
              ถัดไป <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
