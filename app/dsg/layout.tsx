'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  BarChart2,
  Bell,
  ClipboardCheck,
  Cpu,
  GitBranch,
  History,
  House,
  Key,
  LayoutGrid,
  LayoutTemplate,
  Menu,
  Monitor,
  Shield,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import {
  DSG_BOTTOM_ITEMS,
  DSG_MOBILE_TABS,
  DSG_NAV_SECTIONS,
  isNavActive,
  type DsgNavIcon,
  type DsgNavItem,
} from '@/lib/dsg/ui/nav';

function NavIcon({ name, className = 'h-4 w-4' }: { name: DsgNavIcon; className?: string }) {
  switch (name) {
    case 'home':           return <House className={className} aria-hidden="true" />;
    case 'workroom':       return <Monitor className={className} aria-hidden="true" />;
    case 'approvals':      return <ClipboardCheck className={className} aria-hidden="true" />;
    case 'verify':         return <ShieldCheck className={className} aria-hidden="true" />;
    case 'sparkles':       return <Sparkles className={className} aria-hidden="true" />;
    case 'layoutTemplate': return <LayoutTemplate className={className} aria-hidden="true" />;
    case 'gitBranch':      return <GitBranch className={className} aria-hidden="true" />;
    case 'layoutGrid':     return <LayoutGrid className={className} aria-hidden="true" />;
    case 'history':        return <History className={className} aria-hidden="true" />;
    case 'key':            return <Key className={className} aria-hidden="true" />;
    case 'barChart2':      return <BarChart2 className={className} aria-hidden="true" />;
    case 'shield':         return <Shield className={className} aria-hidden="true" />;
    case 'cpu':            return <Cpu className={className} aria-hidden="true" />;
    case 'bell':           return <Bell className={className} aria-hidden="true" />;
  }
}

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400';

function SidebarLink({ item, pathname, onNavigate }: { item: DsgNavItem; pathname: string | null; onNavigate?: () => void }) {
  const active = isNavActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={`mx-2 flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors md:min-h-9 ${FOCUS} ${
        active
          ? 'border border-indigo-500/25 bg-indigo-500/15 text-indigo-200'
          : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
      }`}
    >
      <NavIcon name={item.icon} />
      {item.label}
    </Link>
  );
}

function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();

  return (
    // The global skin makes bg-slate-950 translucent; the phone overlay must be opaque or the
    // tab bar shows through it.
    <aside className={`flex h-full w-60 shrink-0 flex-col border-r border-slate-800 ${onClose ? 'bg-[#030a17]' : 'bg-slate-950'}`}>
      <div className="flex h-14 items-center justify-between border-b border-slate-800 px-4">
        <Link
          href="/dsg/access"
          onClick={onClose}
          className={`-mx-1 flex min-h-11 items-center gap-2 rounded px-1 text-xs font-black uppercase tracking-widest text-white ${FOCUS}`}
        >
          <Sparkles className="h-3.5 w-3.5 text-indigo-400" aria-hidden="true" /> DSG ONE
        </Link>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className={`flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 transition-colors hover:text-slate-200 ${FOCUS}`}
            aria-label="ปิดเมนู"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-2" aria-label="เมนูหลัก">
        {DSG_NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="px-4 pb-1 pt-5 text-xs font-bold tracking-wide text-slate-500">{section.label}</p>
            {section.items.map((item) => (
              <SidebarLink key={item.href} item={item} pathname={pathname} onNavigate={onClose} />
            ))}
          </div>
        ))}
        <div className="mx-4 my-2 border-t border-slate-800" />
        {DSG_BOTTOM_ITEMS.map((item) => (
          <SidebarLink key={item.href} item={item} pathname={pathname} onNavigate={onClose} />
        ))}
        <Link
          href="/"
          onClick={onClose}
          className={`mx-2 flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-800/80 hover:text-slate-200 md:min-h-9 ${FOCUS}`}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> กลับหน้าเว็บ
        </Link>
      </nav>
    </aside>
  );
}

function MobileTabs({ menuOpen, onOpenMenu }: { menuOpen: boolean; onOpenMenu: () => void }) {
  const pathname = usePathname();
  const tabClass = `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-semibold ${FOCUS}`;

  return (
    <nav
      aria-label="เมนูลัด"
      className="flex shrink-0 border-t border-slate-800 bg-slate-950 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {DSG_MOBILE_TABS.map((item) => {
        const active = isNavActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`${tabClass} ${active ? 'text-indigo-300' : 'text-slate-400'}`}
          >
            <NavIcon name={item.icon} className="h-5 w-5" />
            {item.label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onOpenMenu}
        aria-expanded={menuOpen}
        aria-controls="dsg-mobile-menu"
        className={`${tabClass} text-slate-400`}
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
        เมนู
      </button>
    </nav>
  );
}

export default function DsgLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMenu = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-950 text-slate-100">
      <a
        href="#dsg-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[60] focus:rounded-lg focus:bg-indigo-600 focus:px-3 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
      >
        ข้ามไปที่เนื้อหา
      </a>

      <div className="hidden h-full md:flex">
        <Sidebar />
      </div>

      {mobileOpen && (
        <div id="dsg-mobile-menu" role="dialog" aria-modal="true" aria-label="เมนู" className="fixed inset-0 z-50 flex md:hidden">
          <Sidebar onClose={closeMenu} />
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={closeMenu} aria-hidden="true" />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-14 shrink-0 items-center border-b border-slate-800 px-4 md:hidden">
          <span className="text-xs font-black uppercase tracking-widest text-white">DSG ONE</span>
        </div>
        <div id="dsg-main" tabIndex={-1} className="flex-1 overflow-y-auto focus:outline-none">
          {children}
        </div>
        <MobileTabs menuOpen={mobileOpen} onOpenMenu={() => setMobileOpen(true)} />
      </div>
    </div>
  );
}
