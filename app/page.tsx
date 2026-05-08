'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Bell,
  CheckCircle2,
  ChevronRight,
  FileText,
  Lock,
  MessageSquare,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Terminal,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardView } from '@/components/dashboard-view';
import { ExecutionsView } from '@/components/executions-view';
import { AgentsView } from '@/components/agents-view';
import { GovernanceView } from '@/components/governance-view';
import { EnterpriseProofView } from '@/components/enterprise-proof-view';
import { AgentPlaygroundView } from '@/components/agent-playground-view';

type View = 'dashboard' | 'agents' | 'executions' | 'governance' | 'proof' | 'chat';
type ProbeState = 'checking' | 'pass' | 'review' | 'blocked';
type Lang = 'th' | 'en';

type LiveProbe = {
  id: 'product-ready' | 'katzilla' | 'public-ux-research';
  endpoint: string;
  state: ProbeState;
  detail: string;
  checkedAt?: string;
};

type NavItem = {
  id: View;
  icon: typeof MessageSquare;
  label: Record<Lang, string>;
  helper: Record<Lang, string>;
};

const navItems: NavItem[] = [
  { id: 'chat', label: { th: 'สร้างแอป', en: 'Build app' }, helper: { th: 'เริ่มจากไอเดีย', en: 'Start from an idea' }, icon: MessageSquare },
  { id: 'dashboard', label: { th: 'โปรเจกต์ของฉัน', en: 'My projects' }, helper: { th: 'สถานะและขั้นตอนถัดไป', en: 'Status and next actions' }, icon: Activity },
  { id: 'agents', label: { th: 'บริการเอเจนต์', en: 'Agent services' }, helper: { th: 'เครื่องมือที่ใช้ได้', en: 'Usable tools' }, icon: Terminal },
  { id: 'executions', label: { th: 'หลักฐาน', en: 'Evidence' }, helper: { th: 'PR / branch / proof', en: 'PR / branch / proof' }, icon: ShieldCheck },
  { id: 'governance', label: { th: 'กำกับดูแล', en: 'Governance' }, helper: { th: 'นโยบายและอนุมัติ', en: 'Policy and approval' }, icon: Lock },
  { id: 'proof', label: { th: 'ส่งมอบงาน', en: 'Handoff' }, helper: { th: 'รายงานให้ลูกค้า', en: 'Customer report' }, icon: FileText },
];

const copy = {
  th: {
    brandSub: 'บริการสร้างแอปมีหลักฐาน',
    controlPlane: 'พื้นที่บริการลูกค้า',
    language: 'ภาษา',
    searchPlaceholder: 'ค้นหาเมนู เช่น สร้างแอป, หลักฐาน, ตรวจสอบ',
    notificationLabel: 'ดูคำแนะนำขั้นตอนถัดไป',
    noMock: 'ไม่ใช้ข้อมูลจำลอง',
    workTitle: 'พื้นที่ทำงานหลัก',
    workSubtitle: 'ทุกหน้าต้องกดแล้วได้ผล: สร้างงาน, เปิดหลักฐาน, คัดลอก proof, หรือดาวน์โหลดรายงาน',
    rulesTitle: 'กฎหน้าจอ',
    searchNoResult: 'ไม่พบเมนูที่ตรงกัน ลองพิมพ์ สร้างแอป / หลักฐาน / ตรวจสอบ',
    notificationText: 'เริ่มที่ “สร้างแอป” → อนุมัติแผน → สร้าง PR → คัดลอก proof JSON. ยังไม่ใช้ Vercel จนกว่าจะต้องตรวจ preview/production proof.',
    rules: [
      'ใช้เฉพาะข้อมูลจริงจาก endpoint หรือหลักฐานที่คัดลอก/ดาวน์โหลดได้',
      'ไม่แสดงตัวเลขปลอม ไม่ใส่ปุ่มที่กดแล้วไม่เกิดอะไร',
      'ทอง = พร้อมทำต่อ, แดง = ติดขัด, เงิน = รายละเอียดตรวจต่อ',
    ],
    monitor: {
      title: 'สด',
      refresh: 'รีเฟรช',
      pass: 'ผ่าน',
      block: 'ติดขัด',
      review: 'ตรวจต่อ',
      checked: 'ตรวจ',
      notChecked: 'ยังไม่ตรวจ',
      probes: {
        'product-ready': { label: 'Product-ready', defaultDetail: 'กำลังตรวจ readiness API จริง' },
        katzilla: { label: 'Katzilla', defaultDetail: 'กำลังตรวจตัวดึงข้อมูลฟรี' },
        'public-ux-research': { label: 'UX research', defaultDetail: 'ใช้ได้เมื่อมี citation จากแหล่งสาธารณะเท่านั้น' },
      },
      endpointOk: 'endpoint จริงตอบกลับแล้ว',
      serverEvidenceMissing: 'หลักฐานฝั่ง server ยังหาย',
      endpointHttp: 'HTTP',
      endpointUnreachable: 'ติดต่อ endpoint ไม่ได้',
      boundary: 'หลักฐานที่หายต้องแสดงว่าหาย ไม่แทนด้วย mock',
    },
  },
  en: {
    brandSub: 'Evidence-backed app service',
    controlPlane: 'Customer workspace',
    language: 'Language',
    searchPlaceholder: 'Search menu: build app, evidence, handoff',
    notificationLabel: 'Show next-step guidance',
    noMock: 'No mock data',
    workTitle: 'Primary workspace',
    workSubtitle: 'Every screen should produce a tangible action: create work, open evidence, copy proof, or download a report.',
    rulesTitle: 'Screen rules',
    searchNoResult: 'No matching menu. Try build app / evidence / handoff.',
    notificationText: 'Start at Build app → approve plan → create PR → copy proof JSON. Do not spend Vercel quota until preview/production proof is required.',
    rules: [
      'Use only real endpoints or proof users can copy/download',
      'No fake metrics and no dead buttons',
      'Gold = ready, red = blocked, silver = review detail',
    ],
    monitor: {
      title: 'Live',
      refresh: 'Refresh',
      pass: 'Pass',
      block: 'Block',
      review: 'Review',
      checked: 'Checked',
      notChecked: 'not checked',
      probes: {
        'product-ready': { label: 'Product-ready', defaultDetail: 'Checking live readiness API' },
        katzilla: { label: 'Katzilla', defaultDetail: 'Checking free data connector' },
        'public-ux-research': { label: 'UX research', defaultDetail: 'Use only after cited public source is attached' },
      },
      endpointOk: 'Live endpoint responded',
      serverEvidenceMissing: 'Server-side evidence is missing',
      endpointHttp: 'HTTP',
      endpointUnreachable: 'Endpoint unreachable',
      boundary: 'Missing evidence must stay missing, not replaced by mock data',
    },
  },
} as const;

function viewFromHash(): View {
  if (typeof window === 'undefined') return 'chat';
  const value = window.location.hash.replace('#', '') as View;
  return navItems.some((item) => item.id === value) ? value : 'chat';
}

function navigateTo(view: View) {
  window.location.hash = view;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

function statusClass(state: ProbeState) {
  if (state === 'pass') return 'border-[#d6a63a]/40 bg-[#d6a63a]/10 text-[#f5d27a]';
  if (state === 'blocked') return 'border-[#b4232b]/50 bg-[#b4232b]/10 text-[#ffb4b8]';
  if (state === 'checking') return 'border-[#d6a63a]/30 bg-[#d6a63a]/5 text-[#f5d27a]';
  return 'border-[#c8c8c8]/25 bg-[#c8c8c8]/10 text-[#d9d9d9]';
}

function StatusIcon({ state }: { state: ProbeState }) {
  if (state === 'pass') return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (state === 'blocked') return <XCircle className="h-3.5 w-3.5" />;
  if (state === 'checking') return <RefreshCw className="h-3.5 w-3.5 animate-spin" />;
  return <AlertCircle className="h-3.5 w-3.5" />;
}

function formatTime(value: string | undefined, lang: Lang) {
  if (!value) return copy[lang].monitor.notChecked;
  return new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value));
}

async function probe(endpoint: string, lang: Lang): Promise<{ state: ProbeState; detail: string }> {
  const text = copy[lang].monitor;
  try {
    const response = await fetch(endpoint, { cache: 'no-store' });
    const payload = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
    if (response.ok && payload?.ok !== false) return { state: 'pass', detail: text.endpointOk };
    if (response.status === 503) return { state: 'blocked', detail: payload?.error || text.serverEvidenceMissing };
    return { state: 'review', detail: payload?.error || `${text.endpointHttp} ${response.status}` };
  } catch (error) {
    return { state: 'review', detail: error instanceof Error ? error.message : text.endpointUnreachable };
  }
}

function LiveMonitor({ lang }: { lang: Lang }) {
  const text = copy[lang].monitor;
  const [items, setItems] = useState<LiveProbe[]>([
    { id: 'product-ready', endpoint: '/api/dsg/product-ready', state: 'checking', detail: text.probes['product-ready'].defaultDetail },
    { id: 'katzilla', endpoint: '/api/dsg/katzilla/agents', state: 'checking', detail: text.probes.katzilla.defaultDetail },
    { id: 'public-ux-research', endpoint: 'citation required', state: 'review', detail: text.probes['public-ux-research'].defaultDetail },
  ]);

  async function refresh() {
    const checkedAt = new Date().toISOString();
    const [productReady, katzilla] = await Promise.all([
      probe('/api/dsg/product-ready', lang),
      probe('/api/dsg/katzilla/agents', lang),
    ]);

    setItems((current) => current.map((item) => {
      if (item.id === 'product-ready') return { ...item, ...productReady, checkedAt };
      if (item.id === 'katzilla') return { ...item, ...katzilla, checkedAt };
      return { ...item, detail: text.probes['public-ux-research'].defaultDetail, checkedAt };
    }));
  }

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void refresh(), 0);
    const intervalTimer = window.setInterval(() => void refresh(), 30_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(intervalTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const counts = useMemo(() => ({
    pass: items.filter((item) => item.state === 'pass').length,
    blocked: items.filter((item) => item.state === 'blocked').length,
    review: items.filter((item) => item.state === 'review').length,
  }), [items]);

  return (
    <aside className="hidden w-80 shrink-0 border-l border-[#c8c8c8]/15 bg-[#0c0c0d] xl:block">
      <div className="h-screen overflow-y-auto p-3">
        <div className="mb-3 flex items-center justify-between rounded-2xl border border-[#d6a63a]/25 bg-[#d6a63a]/5 px-3 py-2">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#d6a63a]">{text.title}</p>
            <p className="text-xs text-[#c8c8c8]">{text.boundary}</p>
          </div>
          <button onClick={() => void refresh()} className="rounded-xl border border-[#d6a63a]/25 px-2 py-2 text-[#d6a63a]" aria-label={text.refresh}>
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl border border-[#d6a63a]/25 bg-[#d6a63a]/5 p-2 text-[#d6a63a]"><p>{text.pass}</p><p className="text-lg font-black">{counts.pass}</p></div>
          <div className="rounded-xl border border-[#b4232b]/25 bg-[#b4232b]/5 p-2 text-[#ffb4b8]"><p>{text.block}</p><p className="text-lg font-black">{counts.blocked}</p></div>
          <div className="rounded-xl border border-[#c8c8c8]/20 bg-[#c8c8c8]/5 p-2 text-[#c8c8c8]"><p>{text.review}</p><p className="text-lg font-black">{counts.review}</p></div>
        </div>

        <div className="space-y-2">
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-[#c8c8c8]/15 bg-[#111113] p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-[#f2f2f2]">{text.probes[item.id].label}</h3>
                  <p className="truncate font-mono text-[11px] text-[#8d8d8d]">{item.endpoint}</p>
                </div>
                <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-black uppercase', statusClass(item.state))}>
                  <StatusIcon state={item.state} />
                  {item.state}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#c8c8c8]">{item.detail}</p>
              <p className="mt-2 text-[11px] text-[#8d8d8d]">{text.checked}: {formatTime(item.checkedAt, lang)}</p>
            </article>
          ))}
        </div>
      </div>
    </aside>
  );
}

export default function App() {
  const [currentView, setCurrentView] = useState<View>('chat');
  const [lang, setLang] = useState<Lang>('th');
  const [searchQuery, setSearchQuery] = useState('');
  const text = copy[lang];
  const current = navItems.find((item) => item.id === currentView) ?? navItems[0];

  useEffect(() => {
    const syncHash = () => setCurrentView(viewFromHash());
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  function handleNavigate(view: View) {
    setCurrentView(view);
    navigateTo(view);
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchQuery.trim().toLowerCase();
    const found = navItems.find((item) => {
      const labels = [item.id, item.label.th, item.label.en, item.helper.th, item.helper.en].join(' ').toLowerCase();
      return labels.includes(query);
    });
    if (found) {
      handleNavigate(found.id);
      setSearchQuery('');
      return;
    }
    window.alert(text.searchNoResult);
  }

  const renderView = () => {
    switch(currentView) {
      case 'dashboard': return <DashboardView />;
      case 'agents': return <AgentsView />;
      case 'chat': return <AgentPlaygroundView />;
      case 'executions': return <ExecutionsView />;
      case 'governance': return <GovernanceView />;
      case 'proof': return <EnterpriseProofView />;
      default: return <AgentPlaygroundView />;
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#09090a] text-[#c8c8c8]">
      <aside className="w-64 shrink-0 border-r border-[#c8c8c8]/15 bg-[#0c0c0d]">
        <div className="flex h-14 items-center gap-2 border-b border-[#c8c8c8]/15 px-4">
          <Server className="h-4 w-4 text-[#d6a63a]" />
          <div>
            <p className="text-sm font-black tracking-wide text-[#d6a63a]">DSG ONE</p>
            <p className="text-[11px] text-[#8d8d8d]">{text.brandSub}</p>
          </div>
        </div>

        <nav className="space-y-1 p-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={cn(
                  'w-full rounded-xl border px-3 py-2 text-left transition-colors',
                  active ? 'border-[#d6a63a]/35 bg-[#d6a63a]/10 text-[#f5d27a]' : 'border-transparent text-[#c8c8c8] hover:border-[#c8c8c8]/20 hover:bg-[#c8c8c8]/5',
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className={cn('h-4 w-4', active ? 'text-[#d6a63a]' : 'text-[#8d8d8d]')} />
                  <span className="text-sm font-bold">{item.label[lang]}</span>
                </div>
                <p className="mt-0.5 pl-6 text-[11px] text-[#8d8d8d]">{item.helper[lang]}</p>
              </button>
            );
          })}
        </nav>

        <div className="mx-2 mt-2 rounded-xl border border-[#c8c8c8]/15 bg-[#111113] p-3">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#d6a63a]">{text.rulesTitle}</p>
          <div className="mt-2 space-y-1.5">
            {text.rules.map((rule) => (
              <div key={rule} className="flex gap-2 text-[11px] leading-4 text-[#c8c8c8]">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d6a63a]" />
                <span>{rule}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-[#c8c8c8]/15 bg-[#0c0c0d] px-4">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className="text-[#8d8d8d]">{text.controlPlane}</span>
            <ChevronRight className="h-4 w-4 text-[#8d8d8d]" />
            <span className="truncate font-bold text-[#f5d27a]">{current.label[lang]}</span>
          </div>

          <div className="flex items-center gap-2">
            <form onSubmit={handleSearchSubmit} className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8d8d8d]" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={text.searchPlaceholder}
                className="h-9 w-72 rounded-xl border border-[#c8c8c8]/15 bg-[#111113] pl-8 pr-3 text-xs text-[#d9d9d9] outline-none focus:border-[#d6a63a]/40"
              />
            </form>
            <div className="flex rounded-xl border border-[#d6a63a]/25 bg-[#d6a63a]/5 p-0.5" aria-label={text.language}>
              {(['th', 'en'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => setLang(option)}
                  className={cn('rounded-lg px-2.5 py-1.5 text-xs font-black', lang === option ? 'bg-[#d6a63a] text-[#09090a]' : 'text-[#d6a63a]')}
                >
                  {option === 'th' ? 'ไทย' : 'EN'}
                </button>
              ))}
            </div>
            <button onClick={() => window.alert(text.notificationText)} className="rounded-xl border border-[#c8c8c8]/15 p-2 text-[#8d8d8d] hover:border-[#d6a63a]/35 hover:text-[#d6a63a]" aria-label={text.notificationLabel}>
              <Bell className="h-4 w-4" />
            </button>
            <span className="hidden rounded-xl border border-[#b4232b]/30 bg-[#b4232b]/10 px-2.5 py-2 text-[11px] font-black uppercase text-[#ffb4b8] lg:inline-flex">
              {text.noMock}
            </span>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-y-auto p-3">
            <div className="mb-2 flex items-center justify-between rounded-xl border border-[#c8c8c8]/15 bg-[#111113] px-3 py-2">
              <div>
                <h1 className="text-base font-black text-[#f2f2f2]">{text.workTitle}</h1>
                <p className="text-xs text-[#8d8d8d]">{text.workSubtitle}</p>
              </div>
              <span className="rounded-full border border-[#d6a63a]/25 px-2.5 py-1 text-[11px] font-black text-[#d6a63a]">
                {current.label[lang]}
              </span>
            </div>

            <section className="min-h-[calc(100vh-5.5rem)] rounded-xl border border-[#c8c8c8]/15 bg-[#0c0c0d] p-3">
              {renderView()}
            </section>
          </main>
          <LiveMonitor lang={lang} />
        </div>
      </section>
    </div>
  );
}
