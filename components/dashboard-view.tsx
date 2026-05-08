'use client';

import React, { useState } from 'react';
import { AlertTriangle, ArrowRight, Clipboard, FileText, ShieldCheck, Terminal } from 'lucide-react';

const readinessItems = [
  {
    label: 'App Builder backend',
    value: 'พร้อมใช้',
    detail: 'สร้าง goal, PRD, plan, gate, approval และ runtime handoff ได้จาก API จริง',
    icon: FileText,
  },
  {
    label: 'สร้าง PR',
    value: 'พร้อมหลังอนุมัติ',
    detail: 'สร้าง GitHub branch และ PR ก่อน ยังไม่ใช้ Vercel quota',
    icon: Terminal,
  },
  {
    label: 'Production proof',
    value: 'ใช้เมื่อจำเป็น',
    detail: 'ค่อยใช้ Vercel preview/production เฉพาะรอบตรวจหลักฐานจริง',
    icon: AlertTriangle,
  },
  {
    label: 'User protection',
    value: 'เปิดใช้งาน',
    detail: 'หลักฐานที่ยังไม่มีจะแสดงว่ายังไม่มี ไม่แทนด้วยข้อมูลปลอม',
    icon: ShieldCheck,
  },
];

const proofRows = [
  ['Locked goal', 'ได้หลังผู้ใช้สร้าง App Builder job'],
  ['PRD draft', 'ได้หลังผู้ใช้กดสร้างแผน'],
  ['Plan gate', 'PASS / REVIEW / BLOCK จาก gate logic'],
  ['Approval hash', 'ได้หลังผู้ใช้อนุมัติแผนที่เห็นได้'],
  ['Runtime handoff', 'เป็น authorization data ยังไม่ใช่ deploy'],
  ['PR evidence', 'ได้หลังสร้าง GitHub PR สำเร็จ'],
];

function goTo(hash: string) {
  window.location.hash = hash;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function DashboardView() {
  const [copied, setCopied] = useState(false);

  async function copyChecklist() {
    const text = [
      'DSG ONE customer delivery checklist',
      '- Start from Build app',
      '- Generate plan',
      '- Approve visible plan',
      '- Runtime handoff',
      '- Create GitHub PR evidence',
      '- Copy proof JSON',
      '- Use Vercel only for preview/production proof when required',
    ].join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-100">โปรเจกต์ของฉัน</h1>
          <p className="mt-1 text-slate-500">เริ่มงานได้ทันที เห็นสถานะจริง และรู้ขั้นตอนถัดไปโดยไม่เสีย Vercel quota เกินจำเป็น</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => goTo('chat')} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-500">
            เริ่มสร้างแอป <ArrowRight className="h-4 w-4" />
          </button>
          <button onClick={() => void copyChecklist()} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-slate-800">
            <Clipboard className="h-4 w-4" /> {copied ? 'คัดลอกแล้ว' : 'Copy checklist'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5 text-sm leading-7 text-amber-100">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-amber-200">
          <ShieldCheck className="h-4 w-4" /> ใช้หลักฐานจริง ไม่ใช้ mock
        </div>
        <p className="mt-3">
          หน้า dashboard นี้ให้ประโยชน์กับลูกค้าโดยบอกว่าเริ่มตรงไหน ต้องกดอะไรต่อ และหลักฐานที่ได้คืออะไร: แผน, approval hash, runtime handoff และ GitHub PR ก่อนใช้ Vercel quota.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {readinessItems.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.label} onClick={() => goTo(item.label === 'สร้าง PR' ? 'chat' : item.label === 'Production proof' ? 'proof' : 'executions')} className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-left transition hover:border-indigo-500/40 hover:bg-slate-800/60">
              <div className="mb-3 flex items-start justify-between gap-3 text-slate-400">
                <span className="text-sm font-medium">{item.label}</span>
                <Icon className="h-4 w-4 text-indigo-400" />
              </div>
              <div className="mb-2 text-xl font-bold text-slate-200">{item.value}</div>
              <div className="text-xs leading-5 text-slate-500">{item.detail}</div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 lg:col-span-2">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-200">เส้นทางสร้างแอป</h3>
            <button onClick={() => goTo('chat')} className="rounded bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700">เปิดหน้าใช้งาน</button>
          </div>
          <div className="space-y-3">
            {[
              ['1', 'บอกไอเดีย', 'ลูกค้าพิมพ์สิ่งที่อยากได้แบบภาษาคนทั่วไป'],
              ['2', 'เลือกฟีเจอร์', 'ระบบช่วยตั้งค่าฟีเจอร์เริ่มต้นและแก้ได้ก่อนยืนยัน'],
              ['3', 'สร้างแผน', 'API สร้าง PRD, proposed plan และ gate result'],
              ['4', 'อนุมัติ', 'ผู้ใช้เห็นแผนก่อนกดอนุมัติ ไม่รันเองลับหลัง'],
              ['5', 'สร้าง PR', 'สร้าง GitHub branch/PR เป็นหลักฐาน โดยยังไม่ deploy production'],
            ].map(([num, title, detail]) => (
              <button key={num} onClick={() => goTo('chat')} className="grid w-full grid-cols-[40px_1fr] gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-left transition hover:border-indigo-500/30">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/10 text-sm font-bold text-indigo-300">{num}</div>
                <div>
                  <p className="font-semibold text-slate-200">{title}</p>
                  <p className="mt-1 text-sm text-slate-500">{detail}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="mb-4 font-semibold text-slate-200">สิ่งที่ลูกค้าจะจับต้องได้</h3>
          <div className="space-y-3">
            {proofRows.map(([label, detail]) => (
              <button key={label} onClick={() => goTo(label === 'PR evidence' ? 'executions' : 'chat')} className="w-full rounded border border-slate-800/70 bg-slate-950/50 p-3 text-left transition hover:border-indigo-500/30">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-300">{label}</span>
                  <span className="font-mono text-xs text-slate-500">ดูได้</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
              </button>
            ))}
          </div>
          <button onClick={() => goTo('chat')} className="mt-4 w-full rounded-lg border border-indigo-500/40 bg-indigo-500/10 py-2 text-sm font-bold text-indigo-200 transition hover:bg-indigo-500/20">
            ไปสร้างแอปกับ Agent
          </button>
        </div>
      </div>
    </div>
  );
}
