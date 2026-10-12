'use client';

import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Activity, CheckCircle2, CircleX, Hammer, RefreshCw } from 'lucide-react';
import { StatusBadge } from '@/components/status-badge';
import type { AnalyticsRange, AnalyticsSummary } from '@/lib/dsg/analytics/summarize';

type AnalyticsData = AnalyticsSummary & { generatedAt: string; truncated: boolean };
type Loaded = { key: string; data: AnalyticsData } | { key: string; error: string };

const RANGES: AnalyticsRange[] = ['7d', '30d', '90d'];
const RANGE_LABEL: Record<AnalyticsRange, string> = { '7d': '7 วัน', '30d': '30 วัน', '90d': '90 วัน' };

function Trend({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-slate-400">ยังไม่มีช่วงก่อนหน้าให้เทียบ</span>;
  const up = value >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold ${up ? 'text-emerald-400' : 'text-red-400'}`}>
      {up ? <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" /> : <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />}
      {up ? '+' : ''}{value}% เทียบช่วงก่อนหน้า
    </span>
  );
}

function StatCard({ label, value, sub, icon }: { label: string; value: string; sub: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</span>
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800">{icon}</div>
      </div>
      <p className="text-3xl font-black tracking-tight text-slate-100">{value}</p>
      <div className="mt-1">{sub}</div>
    </div>
  );
}

function utc(iso: string) {
  return iso.slice(0, 16).replace('T', ' ');
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<AnalyticsRange>('7d');
  const [reload, setReload] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const key = `${range}:${reload}`;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/dsg/analytics?range=${range}`, { cache: 'no-store', credentials: 'include' })
      .then(async (response): Promise<Loaded | null> => {
        if (response.status === 401) {
          window.location.assign('/login?next=/dsg/analytics');
          return null;
        }
        if (!response.ok) return { key, error: `โหลดสถิติไม่สำเร็จ (HTTP ${response.status}) — กดลองอีกครั้ง หากยังไม่ได้ให้เข้าสู่ระบบใหม่` };
        const body = await response.json() as { ok?: boolean; data?: AnalyticsData };
        return body.ok && body.data ? { key, data: body.data } : { key, error: 'โหลดสถิติไม่สำเร็จ — ข้อมูลที่ได้รับไม่ถูกต้อง กดลองอีกครั้ง' };
      })
      .catch((): Loaded => ({ key, error: 'โหลดสถิติไม่สำเร็จ — เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบเครือข่ายแล้วกดลองอีกครั้ง' }))
      .then((result) => {
        if (!cancelled && result) setLoaded(result);
      });
    return () => {
      cancelled = true;
    };
  }, [range, reload, key]);

  const current = loaded?.key === key ? loaded : null;
  const data = current && 'data' in current ? current.data : null;
  const error = current && 'error' in current ? current.error : null;
  const stats = data?.stats;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-3xl border border-indigo-500/20 bg-indigo-500/10 p-6 shadow-2xl shadow-indigo-950/30 md:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-indigo-200">
                <Activity className="h-3.5 w-3.5" aria-hidden="true" /> Analytics
              </div>
              <h1 className="text-3xl font-black tracking-tight md:text-5xl">Analytics &amp; Usage</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                สถิติการ build ของบัญชีนี้ นับจากประวัติ build จริงเท่านั้น — ไม่มีตัวเลขประมาณการ
              </p>
            </div>
            <div role="group" aria-label="ช่วงเวลา" className="flex items-center gap-1 rounded-2xl border border-slate-700 bg-slate-900 p-1">
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={range === r}
                  onClick={() => setRange(r)}
                  className={`min-h-11 rounded-xl px-4 py-2 text-xs font-bold transition-colors ${range === r ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'}`}
                >
                  {RANGE_LABEL[r]}
                </button>
              ))}
            </div>
          </div>
        </section>

        {error ? (
          <div role="alert" className="flex flex-col gap-3 rounded-3xl border border-amber-500/40 bg-amber-500/10 p-5 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <button type="button" onClick={() => setReload((n) => n + 1)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-400/50 px-4 py-2 font-bold hover:bg-amber-500/10">
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> ลองอีกครั้ง
            </button>
          </div>
        ) : !data ? (
          <p role="status" className="rounded-3xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-300">กำลังโหลดสถิติ…</p>
        ) : null}

        {data && stats ? (
          <>
            <section aria-label="สรุปตัวเลข" className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Builds" value={stats.totalBuilds.toLocaleString('en-US')} sub={<Trend value={stats.totalTrend} />} icon={<Hammer className="h-5 w-5 text-indigo-400" aria-hidden="true" />} />
              <StatCard
                label="Success rate"
                value={stats.successRate === null ? '—' : `${stats.successRate}%`}
                sub={stats.successRate === null ? <span className="text-xs text-slate-400">ยังไม่มี build ที่จบ (deployed/failed)</span> : <Trend value={stats.successTrend} />}
                icon={<CheckCircle2 className="h-5 w-5 text-emerald-400" aria-hidden="true" />}
              />
              <StatCard label="Deployed" value={String(stats.deployed)} sub={<span className="text-xs text-slate-400">ในช่วง {RANGE_LABEL[data.range]}</span>} icon={<CheckCircle2 className="h-5 w-5 text-emerald-400" aria-hidden="true" />} />
              <StatCard label="Failed" value={String(stats.failed)} sub={<span className="text-xs text-slate-400">กำลัง build {stats.building} · ร่าง {stats.draft}</span>} icon={<CircleX className="h-5 w-5 text-red-400" aria-hidden="true" />} />
            </section>

            <section className="grid gap-5 lg:grid-cols-[1fr_320px]">
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
                <h2 className="mb-6 text-xl font-bold">Build Activity</h2>
                {stats.totalBuilds === 0 ? (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-sm text-slate-300">
                    <p className="font-bold text-slate-100">ยังไม่มี build ในช่วง {RANGE_LABEL[data.range]} ที่ผ่านมา</p>
                    <p className="mt-2 text-slate-400">เริ่มสร้างแอปแรกแล้วสถิติจะปรากฏที่นี่</p>
                    {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- native anchor, same reason as the #212 sidebar */}
                    <a href="/dsg/app-builder" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white hover:bg-indigo-500">ไปที่ App Builder</a>
                  </div>
                ) : (
                  <div role="img" aria-label={`จำนวน build ในช่วง ${RANGE_LABEL[data.range]}: ${data.buildActivity.map((b) => `${b.label} ${b.builds}`).join(', ')}`}>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={data.buildActivity} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#f1f5f9' }} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
                        <Bar dataKey="builds" fill="#6366f1" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <p className="mt-3 text-xs text-slate-400">แต่ละแท่งคือวันที่เริ่มช่วง (UTC)</p>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
                <h2 className="mb-4 text-xl font-bold">ยังไม่มีข้อมูลนี้</h2>
                <p className="text-sm leading-6 text-slate-300">
                  ระบบยังไม่เก็บจำนวน token ต้นทุน ระยะเวลา หรือสัดส่วน provider ต่อ build จึงไม่แสดงตัวเลขเหล่านี้ — จะไม่แสดงค่าประมาณแทนค่าจริง
                </p>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="mb-5 text-xl font-bold">Recent Builds</h2>
              {data.recentBuilds.length === 0 ? (
                <p className="text-sm text-slate-400">ไม่มี build ในช่วงนี้</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <caption className="sr-only">Build ล่าสุดในช่วง {RANGE_LABEL[data.range]}</caption>
                    <thead>
                      <tr className="border-b border-slate-800 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                        <th scope="col" className="pb-3 pr-4">App</th>
                        <th scope="col" className="pb-3 pr-4">Status</th>
                        <th scope="col" className="pb-3">Created (UTC)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {data.recentBuilds.map((build) => (
                        <tr key={build.id} className="text-slate-300">
                          <td className="py-3 pr-4 font-bold text-slate-100">{build.appName}</td>
                          <td className="py-3 pr-4"><StatusBadge status={build.status} /></td>
                          <td className="py-3 font-mono text-xs text-slate-400">{utc(build.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {data.truncated ? (
              <p role="status" className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
                จำนวน build มากกว่าที่อ่านได้ในครั้งเดียว ตัวเลขช่วงก่อนหน้าอาจต่ำกว่าความจริง — เลือกช่วงเวลาที่สั้นลง
              </p>
            ) : null}

            <div className="flex flex-col items-center gap-2 pb-4 text-center text-xs text-slate-400">
              <p>ช่วง {utc(data.windowStart)} – {utc(data.windowEnd)} UTC · โหลดเมื่อ {utc(data.generatedAt)} UTC</p>
              <button type="button" onClick={() => setReload((n) => n + 1)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 font-bold text-slate-200 hover:border-slate-500">
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> โหลดใหม่
              </button>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
