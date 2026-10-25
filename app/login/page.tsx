'use client';

import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';

function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dsg/access';
  return value;
}

const subscribeNever = () => () => {};

export default function LoginPage() {
  // Server renders the default; the client re-renders with the real ?next= after hydration,
  // so the displayed route always matches where sign-in will redirect.
  const nextPath = useSyncExternalStore(
    subscribeNever,
    () => safeNextPath(new URLSearchParams(window.location.search).get('next')),
    () => '/dsg/access',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');
  const [message, setMessage] = useState('เข้าสู่ระบบด้วยบัญชี DSG ONE เพื่อกลับไปทำงานต่อ');

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'loading') return;
    setStatus('loading');
    setMessage('กำลังตรวจบัญชีและเปิดพื้นที่ทำงาน…');

    try {
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });
      const payload = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'เข้าสู่ระบบไม่สำเร็จ');

      setStatus('success');
      setMessage('เข้าสู่ระบบสำเร็จ กำลังกลับไปยังหน้าที่เลือก…');
      window.location.assign(nextPath);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Sign in failed.');
    }
  }

  const destination = nextPath.startsWith('/dsg/workroom') ? 'พื้นที่สั่งงาน' :
    nextPath.startsWith('/dsg/approvals') ? 'รายการอนุมัติ' :
    nextPath.startsWith('/dsg/app-builder') ? 'พื้นที่สร้างแอป' : 'พื้นที่ทำงานของคุณ';

  return (
    <main className="flex min-h-dvh flex-col bg-slate-950 px-5 py-6 text-slate-100 sm:px-8">
      <a className="dsg-skip-link" href="#login-form">ข้ามไปฟอร์มเข้าสู่ระบบ</a>
      <Link href="/" className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-bold tracking-wide text-white">
        <ShieldCheck aria-hidden="true" className="h-5 w-5 text-cyan-300" /> DSG ONE
      </Link>
      <div className="mx-auto flex w-full max-w-md flex-1 items-center py-6 sm:py-10">
        <section className="w-full rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8" aria-labelledby="login-heading">
          <h1 id="login-heading" className="text-2xl font-bold tracking-tight">เข้าสู่ระบบเพื่อทำงานต่อ</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            ใช้บัญชี DSG ONE ของคุณ แล้วกลับไปยัง{destination}โดยอัตโนมัติ
          </p>
          <form id="login-form" tabIndex={-1} aria-label="เข้าสู่ระบบ DSG ONE" aria-describedby="login-feedback"
            aria-busy={status === 'loading'} onSubmit={signIn} className="mt-7 space-y-5">
            <div>
              <label htmlFor="dsg-login-email" className="text-sm font-medium text-slate-200">อีเมล</label>
              <input id="dsg-login-email" name="email" value={email} onChange={event => setEmail(event.target.value)}
                type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required
                className="mt-2 min-h-12 w-full rounded-lg border border-slate-500 bg-slate-950 px-3 py-3 text-base text-white"
                placeholder="you@example.com" />
            </div>
            <div>
              <label htmlFor="dsg-login-password" className="text-sm font-medium text-slate-200">รหัสผ่าน</label>
              <div className="relative mt-2">
                <input id="dsg-login-password" name="password" value={password} onChange={event => setPassword(event.target.value)}
                  type={showPassword ? 'text' : 'password'} autoComplete="current-password" required
                  className="min-h-12 w-full rounded-lg border border-slate-500 bg-slate-950 py-3 pl-3 pr-14 text-base text-white" />
                <button type="button" aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} aria-pressed={showPassword}
                  onClick={() => setShowPassword(value => !value)}
                  className="absolute right-1 top-1 inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-slate-300 hover:bg-slate-800">
                  {showPassword ? <EyeOff aria-hidden="true" className="h-5 w-5" /> : <Eye aria-hidden="true" className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={status === 'loading'}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-200 disabled:cursor-wait disabled:bg-slate-700 disabled:text-slate-300">
              {status === 'loading' ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบและทำงานต่อ'} <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </form>
          <p id="login-feedback" role={status === 'error' ? 'alert' : 'status'} aria-live={status === 'error' ? 'assertive' : 'polite'}
            aria-atomic="true" className={`mt-5 text-sm leading-6 ${status === 'error' ? 'text-red-300' : status === 'success' ? 'text-emerald-300' : 'text-slate-400'}`}>
            {message}
          </p>
          <details className="mt-5 border-t border-slate-800 pt-3 text-sm text-slate-400">
            <summary className="min-h-11 cursor-pointer py-2">ปลายทางหลังเข้าสู่ระบบ</summary>
            <p className="mt-1 break-all font-mono text-xs text-slate-300">{nextPath}</p>
          </details>
          <Link href="/" className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-cyan-200 hover:text-white">กลับหน้าแรก</Link>
        </section>
      </div>
    </main>
  );
}

