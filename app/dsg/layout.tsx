'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  LayoutTemplate,
  GitBranch,
  LayoutGrid,
  History,
  BarChart2,
  Shield,
  Cpu,
  Bell,
  Settings,
  ArrowLeft,
  Menu,
  X,
  Key,
} from 'lucide-react';

const navSections = [
  {
    label: 'เริ่มต้น',
    items: [
      { label: 'คุยกับ DSG ONE', href: '/dsg/workroom', iconName: 'cpu' },
    ],
  },
];

// Customers start in a single conversation. Technical and sample routes are
// preserved for owners/operators, but do not compete with chat as entry points.
const advancedItems = [
  { label: 'สร้างแอป · App Builder', href: '/dsg/app-builder', iconName: 'sparkles' },
  { label: 'คำขออนุมัติ · Approvals', href: '/dsg/approvals', iconName: 'shield' },
  { label: 'รายงานความสามารถ', href: '/dsg/autonomous-level', iconName: 'barChart2' },
  { label: 'Governance · อ้างอิง', href: '/dsg/governance', iconName: 'shield' },
  { label: 'Templates · คลังตัวอย่าง', href: '/dsg/templates', iconName: 'layoutTemplate' },
  { label: 'Flow Studio · วางแผน', href: '/dsg/flow-studio', iconName: 'gitBranch' },
  { label: 'Agent Nexus · Telemetry', href: '/dsg/action-layer', iconName: 'layoutGrid' },
  { label: 'API Keys', href: '/dsg/api-keys', iconName: 'key' },
  { label: 'History · ข้อมูลตัวอย่าง', href: '/dsg/history', iconName: 'history' },
  { label: 'Analytics · ข้อมูลตัวอย่าง', href: '/dsg/analytics', iconName: 'barChart2' },
  { label: 'Notifications · ข้อมูลตัวอย่าง', href: '/dsg/notifications', iconName: 'bell' },
];

const bottomItems = [
  { label: 'บัญชีและพื้นที่ทำงาน', href: '/dsg/access', iconName: 'settings' },
];

function NavIcon({ name }: { name: string }) {
  const cls = 'h-4 w-4';
  switch (name) {
    case 'sparkles':       return <Sparkles className={cls} />;
    case 'layoutTemplate': return <LayoutTemplate className={cls} />;
    case 'gitBranch':      return <GitBranch className={cls} />;
    case 'layoutGrid':     return <LayoutGrid className={cls} />;
    case 'history':        return <History className={cls} />;
    case 'barChart2':      return <BarChart2 className={cls} />;
    case 'shield':         return <Shield className={cls} />;
    case 'cpu':            return <Cpu className={cls} />;
    case 'bell':           return <Bell className={cls} />;
    case 'settings':       return <Settings className={cls} />;
    case 'key':            return <Key className={cls} />;
    default:               return null;
  }
}

function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="relative z-10 flex h-full w-64 max-w-[86vw] shrink-0 flex-col border-r border-slate-800 bg-slate-950">
      {/* logo row */}
      <div className="flex h-14 items-center justify-between border-b border-slate-800 px-4">
        <a
          href="/"
          className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white"
        >
          <Sparkles className="h-3.5 w-3.5 text-indigo-400" /> DSG ONE
        </a>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-400 transition-colors hover:text-slate-200"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* navigation */}
      <nav aria-label="DSG ONE sections" className="flex-1 overflow-y-auto py-2">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="px-4 pb-1 pt-5 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {section.label}
            </p>
            {section.items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <a
                  key={item.label}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                                    className={`mx-2 flex min-h-11 touch-manipulation items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
                    active
                      ? 'border border-indigo-500/25 bg-indigo-500/15 text-indigo-200'
                      : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                  }`}
                >
                  <NavIcon name={item.iconName} />
                  {item.label}
                </a>
              );
            })}
          </div>
        ))}
        <details open={advancedItems.some(item => pathname === item.href || pathname.startsWith(item.href + '/'))} className="mx-2 mt-4 rounded-xl border border-slate-800 px-1 py-2">
          <summary className="min-h-11 cursor-pointer touch-manipulation px-3 py-2 text-sm font-medium text-slate-300">
            เมนูผู้ดูแลและข้อมูลเพิ่มเติม
          </summary>
          <div className="mt-2 space-y-1">
            {advancedItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <a key={item.href} href={item.href} aria-current={active ? 'page' : undefined}
                  className={`flex min-h-11 touch-manipulation items-center gap-2.5 rounded-lg px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
                    active ? 'bg-indigo-500/15 text-indigo-200' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}>
                  <NavIcon name={item.iconName} />
                  {item.label}
                </a>
              );
            })}
          </div>
        </details>
      </nav>

      {/* bottom */}
      <div className="border-t border-slate-800 py-2">
        {bottomItems.map((item) => {
          const active = pathname === item.href;
          return (
            <a
              key={item.href}
              href={item.href}
                  aria-current={active ? 'page' : undefined}
                            className={`mx-2 flex min-h-11 touch-manipulation items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
                active
                  ? 'border border-indigo-500/25 bg-indigo-500/15 text-indigo-200'
                  : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
              }`}
            >
              <NavIcon name={item.iconName} />
              {item.label}
            </a>
          );
        })}
        <div className="mx-4 my-2 border-t border-slate-800" />
        <a
          href="/"
                    className="mx-2 flex min-h-11 touch-manipulation items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-800/80 hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" /> Home
        </a>
      </div>
    </aside>
  );
}

export default function DsgLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Hide all administration navigation from the conversational home surface.
  // The routes still exist and are available through its advanced section.
  const chatFirst = pathname === '/dsg/workroom';
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigationDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = navigationDialog.current;
    if (!dialog) return;
    if (mobileOpen && !dialog.open) dialog.showModal();
    else if (!mobileOpen && dialog.open) dialog.close();
  }, [mobileOpen]);

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-slate-950 text-slate-100">
      {/* desktop sidebar */}
      {!chatFirst && <div className="dsg-sidebar-desktop hidden h-full md:flex">
        <Sidebar />
      </div>}

      {/* mobile overlay */}
      {!chatFirst && (
        <dialog ref={navigationDialog} id="dsg-navigation-dialog" aria-label="เมนู DSG ONE" aria-modal="true"
          onKeyDown={event => {
            if (event.key !== 'Tab') return;
            const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
              'a[href],button:not([disabled]),summary,[tabindex="0"]',
            )).filter(element => element.getClientRects().length > 0);
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault(); last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault(); first?.focus();
            }
          }}
          onClose={() => setMobileOpen(false)}
          className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-0 text-slate-100 backdrop:bg-black/60">
          <div className="dsg-sidebar-mobile-overlay flex h-full w-full">
            <Sidebar onClose={() => setMobileOpen(false)} />
            <button type="button" aria-label="ปิดเมนู" className="min-w-11 flex-1 bg-transparent"
              onClick={() => setMobileOpen(false)} />
          </div>
        </dialog>
      )}

      {/* main area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {!chatFirst && <div className="dsg-sidebar-mobile-header flex h-14 shrink-0 items-center border-b border-slate-800 px-4 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            aria-haspopup="dialog" aria-controls="dsg-navigation-dialog" aria-expanded={mobileOpen}
            className="flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="ml-3 text-xs font-black uppercase tracking-widest text-white">
            DSG ONE
          </span>
        </div>}
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

