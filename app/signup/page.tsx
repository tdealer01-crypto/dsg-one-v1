'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';

export default function DsgPilotSignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState('');

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error ?? 'SIGNUP_FAILED');
      setCompleted(true);
      setPassword('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'SIGNUP_FAILED');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-12 text-slate-100">
      <section className="mx-auto max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-7 sm:p-10">
        <div className="flex items-center gap-2 text-sm font-bold text-cyan-300"><ShieldCheck className="h-5 w-5" /> DSG ONE · Pilot</div>
        <h1 className="mt-5 text-3xl font-black">สมัครบัญชี DSG ONE</h1>
        <p className="mt-4 text-sm leading-7 text-slate-300">
          ใช้บัญชี DSG ONE v1 เดิมในการสมัครทดลอง ไม่ใช่บัญชี Admin ของ Cloud Computer
          การสมัครยังไม่เปิดสิทธิ์เข้าถึง AWS, Desktop หรือ Agent Execution
        </p>
        {completed ? (
          <div className="mt-7 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
            <h2 className="font-bold text-emerald-200">รับคำขอสร้างบัญชีแล้ว</h2>
            <p className="mt-2 text-sm leading-6 text-slate-200">หากมีอีเมลยืนยัน ให้ยืนยันก่อน แล้วเข้าสู่ระบบเพื่อส่งคำขอทดลอง DSG ONE</p>
            <Link href="/login?next=/try" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 font-bold text-slate-950">เข้าสู่ระบบ <ArrowRight size={17} /></Link>
          </div>
        ) : (
          <form onSubmit={register} className="mt-7 space-y-5">
            <label className="block text-sm font-bold">อีเมล
              <input type="email" required autoComplete="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" />
            </label>
            <label className="block text-sm font-bold">รหัสผ่าน (12 อักขระขึ้นไป)
              <input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" />
            </label>
            {error && <p role="alert" className="text-sm text-red-300">ไม่สำเร็จ: {error}</p>}
            <button type="submit" disabled={pending} className="w-full rounded-xl bg-cyan-300 px-4 py-3 font-bold text-slate-950 disabled:opacity-50">
              {pending ? 'กำลังส่งคำขอ…' : 'สมัครบัญชี DSG ONE'}
            </button>
          </form>
        )}
        <p className="mt-6 text-sm text-slate-400">
          มีบัญชีอยู่แล้ว? <Link href="/login?next=/try" className="font-bold text-cyan-300 underline">เข้าสู่ระบบ</Link>
        </p>
        <p className="mt-3 text-xs leading-6 text-amber-200/90">
          Pilot ต้องได้รับอนุมัติแยกจากสิทธิ์เว็บไซต์ การสมัครบัญชีไม่ได้สร้าง Workspace หรืออนุมัติ Runtime Route อัตโนมัติ
        </p>
      </section>
    </main>
  );
}