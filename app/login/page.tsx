'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';

function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dsg/access';
  return value;
}

export default function LoginPage() {
  const [nextPath] = useState<string>(() => {
    if (typeof window === 'undefined') return '/dsg/access';
    return safeNextPath(new URLSearchParams(window.location.search).get('next'));
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');
  const [message, setMessage] = useState('Sign in once to establish a protected DSG session.');

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('loading');
    setMessage('Checking credentials and creating DSG session…');

    try {
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });
      const payload = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Sign in failed.');

      setStatus('success');
      setMessage('Signed in. Redirecting to DSG Access Console…');
      window.location.assign(nextPath);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Sign in failed.');
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900 shadow-2xl shadow-indigo-950/20 md:grid-cols-[1fr_0.9fr]">
          <div className="bg-gradient-to-br from-indigo-600/20 via-slate-950 to-slate-950 p-8 md:p-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-indigo-200">
              <ShieldCheck className="h-3.5 w-3.5" /> DSG Protected Access
            </div>
            <h1 className="mt-6 text-4xl font-black tracking-tight md:text-5xl">Sign in once. Enter the governed workspace.</h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-slate-400">
              Email sign-in creates a secure HttpOnly DSG session. Runtime credentials remain server-side in Azure Key Vault and are never exposed to the browser.
            </p>
            <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Next route</p>
              <p className="mt-2 break-all font-mono text-sm text-indigo-200" suppressHydrationWarning>{nextPath}</p>
            </div>
          </div>

          <div className="p-8 md:p-10">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <form onSubmit={signIn} className="space-y-4">
              <label className="block text-sm font-bold text-slate-300">
                Email
                <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition-colors focus:border-indigo-500" placeholder="you@example.com" />
              </label>
              <label className="block text-sm font-bold text-slate-300">
                Password
                <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition-colors focus:border-indigo-500" placeholder="••••••••" />
              </label>
              <button type="submit" disabled={status === 'loading'} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">
                {status === 'loading' ? 'Signing in…' : 'Continue'} <ArrowRight className="h-4 w-4" />
              </button>
            </form>
            <p className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${status === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-200' : status === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-slate-800 bg-slate-950 text-slate-400'}`}>
              {message}
            </p>
            <Link href="/" className="mt-5 inline-flex text-sm font-bold text-indigo-300 hover:text-indigo-200">Back to home</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
