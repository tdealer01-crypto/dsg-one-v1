'use client';

import Link from 'next/link';
import { PublicProductionSnapshot } from '@/components/public-production-snapshot';
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  LayoutTemplate,
  LogIn,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

const systemEntries = [
  {
    title: 'บัญชีและพื้นที่ทำงาน',
    description: 'เข้าสู่ระบบ ดูบัญชี และเลือกพื้นที่ทำงานของคุณ',
    href: '/dsg/access',
    badge: 'Sign-in required',
    external: false,
  },
  {
    title: 'สั่งงานผ่านแชท',
    description: 'พิมพ์สิ่งที่ต้องการ แล้วติดตามงานและผลลัพธ์ได้ในที่เดียว',
    href: '/dsg/workroom',
    badge: 'Sign-in required',
    external: false,
  },
  {
    title: 'DSG Agent v0 · Qwen Planner',
    description: 'ส่งเป้าหมายให้ Qwen เสนอแผนผ่าน AWS Spacetime (proposal-only) ตรวจผลจากโมเดลจริงเท่านั้น; Kaggle Worker อาจยังไม่พร้อม',
    href: '/dsg/workroom?tool=agent-v0',
    badge: 'วางแผน · ตรวจ Inference ก่อนลงมือทำ',
    external: false,
  },
  {
    title: 'สั่งงานอุปกรณ์ DSG Native',
    description: 'สั่งคำสั่งบนอุปกรณ์ Native ที่เชื่อมไว้ ตรวจผลเมื่อโปรเซสทำงานเสร็จ และอนุมัติเฉพาะงานที่จำเป็น',
    href: '/dsg/workroom?tool=desktop',
    badge: 'เชื่อมอุปกรณ์ · อนุมัติตามความจำเป็น',
    external: false,
  },
  {
    title: 'DSG OS',
    description: 'Adapter Builder and local evidence verifier. Browser-side tools do not authorize execution.',
    href: '/dsg-os',
    badge: 'Public tools',
    external: false,
  },
  {
    title: 'ควบคุมเว็บด้วย Cinema',
    description: 'เชื่อมเบราว์เซอร์ เปิดเว็บไซต์ และดูผลหลังได้รับอนุญาต',
    href: '/dsg/workroom?tool=browser',
    badge: 'Workroom · approval-gated',
    external: false,
  },
  {
    title: 'GitBook Docs',
    description: 'Read the source-synced canonical documentation, current queue and evidence boundaries.',
    href: 'https://dsg-3.gitbook.io/dsg-docs/dsg-docs/dsg-one-canonical-7-docs/',
    badge: 'Canonical docs',
    external: true,
  },
  {
    title: 'รายการรออนุมัติ',
    description: 'ตรวจคำขอและยืนยันเฉพาะเมื่อระบบต้องการ MFA',
    href: '/dsg/approvals',
    badge: 'Approver sign-in',
    external: false,
  },
  {
    title: 'App Builder',
    description: 'Continue building DSG applications inside the existing protected workspace.',
    href: '/dsg/app-builder',
    badge: 'Sign-in required',
    external: false,
  },
  {
    title: 'Browser Execution Pilot',
    description: 'Read the supervised browser pilot scope and request a governed trial.',
    href: '/remote-browser-execution',
    badge: 'Public pilot',
    external: false,
  },
] as const;

const steps = [
  {
    number: '01',
    title: 'พิมพ์เป้าหมายของงาน',
    desc: 'เข้า Workroom และอธิบายสิ่งที่ต้องการด้วยภาษาปกติ',
  },
  {
    number: '02',
    title: 'ระบบตรวจแผนและสิทธิ์',
    desc: 'งานที่ต้องอนุมัติจะรอเจ้าของยืนยัน ไม่มีการข้าม Gate หรือสร้างผลลัพธ์จำลอง',
  },
  {
    number: '03',
    title: 'ดูผลและหลักฐาน',
    desc: 'ดู PASS / REVIEW / BLOCKED จากงานจริง พร้อมเหตุผลและขั้นต่อไป',
  },
];

const publicPrinciples = [
  'Evidence before execution',
  'Blocked states stay blocked',
  'Runtime credentials stay server-side',
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-white">
            <Sparkles className="h-4 w-4 text-cyan-300" />
            DSG ONE
          </Link>

          <nav className="hidden items-center gap-2 md:flex">
            <Link href="/dsg/workroom" className="rounded-xl px-3 py-2 text-sm font-semibold text-cyan-300 hover:bg-slate-800 hover:text-white">สั่งงาน</Link>
            <Link href="/dsg/workroom?tool=agent-v0" className="rounded-xl px-3 py-2 text-sm font-semibold text-cyan-200 hover:bg-slate-800 hover:text-white">Agent v0 · Qwen</Link>
            <Link href="/dsg/workroom?tool=desktop" className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-cyan-200">อุปกรณ์ Native</Link>
            <Link href="/dsg/workroom?tool=browser" className="rounded-xl px-3 py-2 text-sm font-semibold text-cyan-200 hover:bg-slate-800 hover:text-white">ควบคุมเว็บ</Link>
            <a href="#how-it-works" className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-white">
              วิธีใช้งาน
            </a>
            <a href="#truth-boundary" className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-white">
              ตรวจหลักฐาน
            </a>
            <Link href="/login?next=/dsg/access" className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold text-slate-200 hover:border-cyan-300/50 hover:text-white">
              <LogIn className="h-4 w-4" />
              เข้าสู่ระบบ
            </Link>
          </nav>

          <div className="flex items-center gap-2 md:hidden">
            <details className="group relative">
              <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">
                เมนู
              </summary>
              <nav aria-label="Mobile navigation" className="absolute right-0 top-12 z-50 flex w-64 max-w-[calc(100vw-2rem)] flex-col gap-1 rounded-2xl border border-slate-700 bg-slate-900 p-2 text-sm shadow-2xl">
                <Link href="/dsg/workroom" className="rounded-lg px-3 py-3 text-cyan-200 hover:bg-slate-800">สั่งงานผ่านแชท</Link>
                <Link href="/dsg/workroom?tool=agent-v0" className="rounded-lg px-3 py-3 hover:bg-slate-800">Agent v0 · วางแผนงาน</Link>
                <Link href="/dsg/workroom?tool=desktop" className="rounded-lg px-3 py-3 hover:bg-slate-800">สั่งงานอุปกรณ์ Native</Link>
                <Link href="/dsg/workroom?tool=browser" className="rounded-lg px-3 py-3 hover:bg-slate-800">ควบคุมเว็บ</Link>
                <Link href="/dsg/approvals" className="rounded-lg px-3 py-3 hover:bg-slate-800">รายการอนุมัติ</Link>
                <a href="#system-access" className="rounded-lg px-3 py-3 hover:bg-slate-800">เครื่องมือทั้งหมด</a>
                <Link href="/architecture-3d.html" className="rounded-lg px-3 py-3 hover:bg-slate-800">สถาปัตยกรรม 3D</Link>
                <a href="#truth-boundary" className="rounded-lg px-3 py-3 hover:bg-slate-800">หลักฐานและข้อจำกัด</a>
              </nav>
            </details>
            <Link href="/dsg/workroom" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-300 px-3 py-2 text-xs font-black text-slate-950 hover:bg-cyan-200">
              <LogIn className="h-4 w-4" />
              เริ่มงาน
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950/30 to-slate-950 px-5 py-24 text-center sm:px-8 sm:py-32">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(34,211,238,0.12),transparent_42%)]" />
        <div className="relative mx-auto max-w-5xl">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            Public DSG ONE landing
          </div>
          <h1 className="mt-7 text-4xl font-black leading-tight tracking-tight sm:text-7xl">
            สั่ง AI ทำงาน
            <span className="mt-2 block text-cyan-300">เห็นผลที่ตรวจสอบได้</span>
          </h1>
          <p className="mx-auto mt-7 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
            เริ่มจากเป้าหมายของคุณ DSG ONE ตรวจแผน สิทธิ์ และการเชื่อมต่อก่อนให้ Agent ลงมือทำ
            แล้วแสดงผลและหลักฐานจากระบบจริง หากทำไม่ได้จะแจ้งสาเหตุ ไม่แสดงความสำเร็จปลอม
          </p>
          <p className="mt-4 text-sm font-semibold leading-7 text-cyan-200">
            บอกเป้าหมาย → ตรวจสิทธิ์ → ทำงานเมื่อได้รับอนุญาต → ดูผลและหลักฐาน
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/dsg/workroom" className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-cyan-300 px-6 py-3.5 text-sm font-black text-slate-950 hover:bg-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              เริ่มสั่งงานผ่านแชท
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/try" className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-indigo-500 px-6 py-3.5 text-sm font-black text-white hover:bg-indigo-400">
              สมัครทดลอง DSG ONE (รออนุมัติ)
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/dsg/access" className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/60 px-6 py-3.5 text-sm font-bold text-slate-200 hover:border-cyan-300/50 hover:bg-slate-800">
              ดูสถานะและเครื่องมือ
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link href="/dsg/approvals" className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-950/40 px-6 py-3.5 text-sm font-bold text-emerald-100 hover:border-emerald-300/70 hover:bg-emerald-950/60">
              ตรวจรายการรออนุมัติ
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <p className="mt-6 text-xs text-slate-500">
            หน้าแรกเปิดดูได้โดยไม่ต้องเข้าสู่ระบบ งานจริงต้องมีบัญชี สิทธิ์ และ Provider ที่พร้อมใช้งาน
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-20 px-5 py-16 sm:px-8">
        <section id="system-access" aria-labelledby="system-access-heading" className="scroll-mt-24">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-3xl">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-cyan-300">One website · existing tools</p>
              <h2 id="system-access-heading" className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">DSG ONE — เครื่องมือและพื้นที่ทำงาน</h2>
              <p className="mt-3 text-sm leading-7 text-slate-400">
                เลือกเข้าเครื่องมือเดิมจากหน้านี้ได้โดยตรง เครื่องมือที่มีการควบคุมสิทธิ์จะให้เข้าสู่ระบบตามปกติ
                Links do not grant execution permission or bypass Spacetime, Auth0, MFA, or the approval ledger.
              </p>
            </div>
            <Link href="/login?next=/dsg/access" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 hover:bg-cyan-200">
              บัญชีและพื้นที่ทำงาน <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {systemEntries.map((entry) => (
              <a
                key={entry.title}
                href={entry.href}
                target={entry.external ? '_blank' : undefined}
                rel={entry.external ? 'noopener noreferrer' : undefined}
                className="group flex h-full min-h-48 flex-col rounded-2xl border border-slate-700/80 bg-slate-900/80 p-5 transition hover:border-cyan-400/60 hover:bg-slate-800/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
              >
                <span className="self-start rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-[11px] font-semibold text-cyan-200">{entry.badge}</span>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold text-white">{entry.title}</h3>
                  <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 text-cyan-300 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-400">{entry.description}</p>
              </a>
            ))}
          </div>
          <p className="mt-5 text-xs leading-6 text-amber-200/80">
            Production truth boundary: OAuth-bound signed read-only provider E2E is verified for its exact scope.
            Cinema high-risk connect/execute, Quest and whole-system E2E are not verified. A reachable page is not an execution receipt.
            MCP clients continue to use the separate OAuth-protected https://aws.dsg.pics/mcp endpoint.
          </p>
        </section>

        <PublicProductionSnapshot />
        <section id="how-it-works" className="scroll-mt-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-cyan-300">เริ่มใช้งาน 3 ขั้นตอน</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">หนึ่งงาน ตั้งแต่สั่งจนเห็นผล</h2>
          </div>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {steps.map((step) => (
              <article key={step.number} className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-2xl font-black text-slate-600">{step.number}</span>
                  <span className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-2 text-cyan-200">
                    {step.number === '03' ? <CheckCircle2 className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-black">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">{step.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-7">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-indigo-300">Designed for governed work</p>
            <h2 className="mt-3 text-2xl font-black">Make the result understandable before it becomes an action.</h2>
            <div className="mt-6 space-y-3">
              {publicPrinciples.map((principle) => (
                <div key={principle} className="flex items-center gap-3 text-sm text-slate-300">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                  {principle}
                </div>
              ))}
            </div>
          </div>
          <div id="truth-boundary" className="scroll-mt-24 rounded-3xl border border-amber-400/20 bg-amber-400/[0.06] p-7">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-amber-200">Truth boundary</p>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              A proof receipt shows that a governed flow was evaluated. It does not claim production readiness, deployment, certification, or marketplace approval unless separate evidence proves those states.
            </p>
          </div>
        </section>

        <section aria-labelledby="public-architecture-heading" className="rounded-3xl border border-cyan-500/20 bg-slate-900/80 p-7 sm:p-9">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.22em] text-cyan-300"><LayoutTemplate className="h-4 w-4" /> Public interactive architecture</p>
              <h2 id="public-architecture-heading" className="mt-3 text-2xl font-black sm:text-3xl">Explore the five trust domains in 3D.</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">A no-login, interactive architecture explainer covering Proposal, Proof, Authority, Execution and Evidence, with a dated 11 October 2026 AWS deployment evidence snapshot.</p>
              <p className="mt-2 text-xs leading-6 text-amber-200/80">AWS image activation #38140649005 and signed read-only canary #38140811436 PASS (11 Oct 2026). Real user OAuth → governed GitHub metadata read-only provider → independently checked Ed25519 evidence E2E PASS for that limited scope. Production MCP chain readback on 11 Oct: valid, 140 records. Cinema browser Connect/Execute, Quest/Unity and whole-system E2E remain NOT VERIFIED; Workroom store is UNAVAILABLE. This is a dated evidence checkpoint, not live telemetry.</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Link href="/architecture-3d.html" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 hover:bg-cyan-200">Open 3D model <ArrowUpRight className="h-4 w-4" /></Link>
              <Link href="/closure-dashboard.html" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-500/25 bg-amber-950/20 px-5 py-3 text-sm font-bold text-amber-100 hover:border-amber-300/50">Closure checklist <ArrowUpRight className="h-4 w-4" /></Link>
              <a href="https://dsg-3.gitbook.io/dsg-docs/dsg-docs/dsg-one-canonical-7-docs/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 px-5 py-3 text-sm font-bold text-slate-200 hover:border-cyan-400/50">Public status docs <ArrowUpRight className="h-4 w-4" /></a>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-gradient-to-r from-indigo-950/50 to-slate-900 p-7 sm:p-9">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-cyan-300">Next step</p>
              <h2 className="mt-3 text-2xl font-black">Enter the protected DSG workspace.</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">Sign in once, then choose the governed workspace and open Verify, Build, Workroom, or the available runtime surfaces.</p>
            </div>
            <Link href="/login?next=/dsg/access" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-indigo-500 px-5 py-3 text-sm font-black text-white hover:bg-indigo-400">
              Open Access
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 pt-8 text-sm text-slate-500">
          <span>DSG ONE · Evidence-first AI governance</span>
          <Link href="/login?next=/dsg/access" className="inline-flex items-center gap-2 font-bold text-indigo-300 hover:text-indigo-200">
            Protected product access
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </section>
      </div>
    </main>
  );
}
