import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  LayoutTemplate,
  LogIn,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { ACCESS_REQUEST_EMAIL, accessRequestMailto } from '@/lib/dsg/public/access-request';

export const metadata: Metadata = {
  title: { absolute: 'DSG ONE — ตรวจสอบก่อนให้ AI ลงมือทำ' },
  description:
    'DSG ONE ช่วยให้ทีมประเมินการกระทำของ AI ผ่านเส้นทางที่มีการกำกับ และเห็นหลักฐานเบื้องหลังคำตัดสินก่อนอนุญาตให้ลงมือทำ',
};

const steps = [
  {
    number: '01',
    title: 'ระบุการกระทำของ AI หนึ่งอย่าง',
    desc: 'บอกผลลัพธ์ที่ต้องการเป็นภาษาธรรมดา',
  },
  {
    number: '02',
    title: 'DSG ประเมินเส้นทางที่กำกับ',
    desc: 'ประเมินแผนและด่านตรวจก่อนลงมือ โดยไม่เปลี่ยนสถานะที่ถูกบล็อกให้กลายเป็นสำเร็จ',
  },
  {
    number: '03',
    title: 'รับใบรับรองหลักฐาน (proof receipt)',
    desc: 'เห็น proof hash สถานะการตัดสิน เหตุผลที่ถูกบล็อก และขั้นต่อไปที่ปลอดภัย',
  },
];

const publicPrinciples = [
  'หลักฐานก่อนลงมือทำ',
  'สถานะที่ถูกบล็อกยังคงถูกบล็อก',
  'รหัสลับของระบบอยู่ฝั่งเซิร์ฟเวอร์เท่านั้น',
];

const sampleReceipt = [
  { label: 'การกระทำที่ขอ', value: 'ลบข้อมูลลูกค้าทั้งหมดในฐานข้อมูลหลัก' },
  { label: 'ผลการตัดสิน', value: 'BLOCK' },
  {
    label: 'เหตุผลที่ถูกบล็อก',
    value: 'ต้องมีผู้มีอำนาจอนุมัติ (APPROVAL_REQUIRED) · ยังไม่ได้ระบุขอบเขตข้อมูลที่จะลบ',
  },
  { label: 'ขั้นต่อไปที่ปลอดภัย', value: 'ขอการอนุมัติ และระบุขอบเขตข้อมูลให้ชัดก่อนส่งใหม่' },
  { label: 'proof hash', value: 'สร้างจริงทุกครั้งที่ระบบประเมิน — ตัวอย่างนี้ไม่มีค่า hash' },
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
            <Link href="/architecture-3d.html" className="rounded-xl px-3 py-2 text-sm font-semibold text-cyan-300 hover:bg-slate-800 hover:text-white">3D architecture</Link>
            <Link href="/closure-dashboard.html" className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-cyan-200">Closure checklist</Link>
            <a href="#how-it-works" className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-white">
              วิธีการทำงาน
            </a>
            <a href="#truth-boundary" className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-white">
              ขอบเขตความจริง
            </a>
            <a href={accessRequestMailto()} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 hover:bg-cyan-200">
              <Mail className="h-4 w-4" />
              ขอสิทธิ์ใช้งาน
            </a>
            <Link href="/login?next=/dsg/access" className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold text-slate-200 hover:border-cyan-300/50 hover:text-white">
              <LogIn className="h-4 w-4" />
              เข้าสู่ระบบ
            </Link>
          </nav>

          <div className="flex items-center gap-2 md:hidden">
            <a href={accessRequestMailto()} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-cyan-300 px-3 py-2 text-xs font-black text-slate-950">
              <Mail className="h-4 w-4" />
              ขอสิทธิ์
            </a>
            <Link href="/login?next=/dsg/access" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200">
              <LogIn className="h-4 w-4" />
              เข้าสู่ระบบ
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950/30 to-slate-950 px-5 py-24 text-center sm:px-8 sm:py-32">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(34,211,238,0.12),transparent_42%)]" />
        <div className="relative mx-auto max-w-5xl">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-1.5 text-xs font-bold tracking-[0.12em] text-cyan-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            หน้าสาธารณะ · ดูได้โดยไม่ต้องมีบัญชี
          </div>
          <h1 className="mt-7 text-5xl font-black tracking-tight sm:text-7xl">
            ตรวจสอบก่อน
            <br className="hidden sm:block" /> ให้ AI ลงมือทำ
          </h1>
          <p className="mt-3 font-mono text-sm tracking-[0.18em] text-slate-400">Verify before AI executes.</p>
          <p className="mx-auto mt-7 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
            DSG ONE ช่วยให้ทีมประเมินการกระทำของ AI ผ่านเส้นทางที่มีการกำกับ และเห็นหลักฐานเบื้องหลังคำตัดสินก่อนอนุญาตให้ลงมือทำ
          </p>
          <p className="mt-4 font-mono text-sm tracking-[0.18em] text-cyan-300/80">
            Action → Gate → Decision → Proof
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <a href={accessRequestMailto()} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-cyan-300 px-6 py-3.5 text-sm font-black text-slate-950 hover:bg-cyan-200">
              <Mail className="h-4 w-4" />
              ขอสิทธิ์ใช้งานทางอีเมล
            </a>
            <a href="#sample-receipt" className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/60 px-6 py-3.5 text-sm font-bold text-slate-200 hover:border-cyan-300/50 hover:bg-slate-800">
              ดูตัวอย่างใบรับรอง
              <ArrowRight className="h-4 w-4" />
            </a>
            <Link href="/login?next=/dsg/access" className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-slate-700 px-6 py-3.5 text-sm font-bold text-slate-200 hover:border-cyan-300/50 hover:bg-slate-800">
              <LogIn className="h-4 w-4" />
              มีบัญชีแล้ว? เข้าสู่ระบบ
            </Link>
          </div>

          <p className="mt-6 text-sm text-slate-400">
            ดูเพิ่มเติม:{' '}
            <Link href="/architecture-3d.html" className="font-semibold text-cyan-300 underline-offset-4 hover:underline">แผนภาพสถาปัตยกรรม 3D</Link>
            {' · '}
            <Link href="/remote-browser-execution" className="font-semibold text-emerald-300 underline-offset-4 hover:underline">DSG Spacetime · Browser pilot (signed approval required)</Link>
          </p>
          <p className="mt-3 text-xs text-slate-500">
            หน้านี้เปิดดูได้โดยไม่ต้องมีบัญชี ส่วนการใช้งานจริงต้องได้รับสิทธิ์ก่อน — ขอได้ทางอีเมล {ACCESS_REQUEST_EMAIL}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-20 px-5 py-16 sm:px-8">
        <section id="how-it-works" className="scroll-mt-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-cyan-300">First value</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">เส้นทางตัดสินใจที่ชัดเจนสำหรับทุกการกระทำ</h2>
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

        <section id="sample-receipt" aria-labelledby="sample-receipt-heading" className="scroll-mt-24 rounded-3xl border border-slate-800 bg-slate-900/80 p-7 sm:p-9">
          <p className="inline-flex rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-200">
            ตัวอย่างประกอบ — ไม่ใช่ผลจริง และไม่ใช่ข้อมูลจากระบบ
          </p>
          <h2 id="sample-receipt-heading" className="mt-4 text-2xl font-black sm:text-3xl">ใบรับรองหลักฐานหน้าตาเป็นแบบนี้</h2>
          <p className="mt-2 text-sm leading-7 text-slate-400">
            ตัวอย่างของการกระทำที่ถูกบล็อก เพื่อให้เห็นว่าคุณจะได้อะไรกลับมา โดยไม่ต้องล็อกอิน
          </p>
          <dl className="mt-6 divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-950/60">
            {sampleReceipt.map((row) => (
              <div key={row.label} className="grid gap-1 px-5 py-4 sm:grid-cols-[13rem_1fr] sm:gap-4">
                <dt className="text-sm font-bold text-slate-400">{row.label}</dt>
                <dd className={`text-sm leading-7 ${row.value === 'BLOCK' ? 'font-black text-rose-300' : 'text-slate-200'}`}>{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs leading-6 text-slate-500">
            ใบรับรองจริงแสดงว่าการกระทำนั้นถูกประเมินผ่านเส้นทางที่กำกับ ไม่ได้รับรองว่าระบบพร้อมใช้งานจริง
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-7">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-indigo-300">Designed for governed work</p>
            <h2 className="mt-3 text-2xl font-black">ทำให้ผลลัพธ์เข้าใจได้ก่อนที่มันจะกลายเป็นการลงมือทำ</h2>
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
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-amber-200">ขอบเขตความจริง · Truth boundary</p>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              ใบรับรองหลักฐานแสดงว่าขั้นตอนที่กำกับถูกประเมินแล้วเท่านั้น ไม่ได้รับรองว่าพร้อมใช้งานจริง ถูก deploy แล้ว ผ่านการรับรอง หรือได้รับอนุมัติจาก marketplace เว้นแต่มีหลักฐานแยกต่างหากพิสูจน์สถานะเหล่านั้น
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
              <a href="https://dsg-3.gitbook.io/dsg-docs/control-plane/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 px-5 py-3 text-sm font-bold text-slate-200 hover:border-cyan-400/50">Public status docs <ArrowUpRight className="h-4 w-4" /></a>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-gradient-to-r from-indigo-950/50 to-slate-900 p-7 sm:p-9">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-cyan-300">Next step</p>
              <h2 className="mt-3 text-2xl font-black">ขอสิทธิ์ใช้งานทางอีเมล</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                ส่งชื่อ องค์กร อีเมลที่จะใช้ล็อกอิน และสิ่งที่อยากใช้ทำ มาที่ {ACCESS_REQUEST_EMAIL} เมื่อได้รับสิทธิ์แล้วจึงเข้าสู่ระบบและเลือก workspace เพื่อเปิด Verify, Build, Workroom หรือส่วนที่เปิดให้ใช้งาน
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <a href={accessRequestMailto()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 hover:bg-cyan-200">
                <Mail className="h-4 w-4" />
                ส่งอีเมลขอสิทธิ์
              </a>
              <Link href="/login?next=/dsg/access" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-indigo-400/40 px-5 py-3 text-sm font-black text-indigo-100 hover:bg-indigo-500/20">
                มีบัญชีแล้ว เข้าสู่ระบบ
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
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
