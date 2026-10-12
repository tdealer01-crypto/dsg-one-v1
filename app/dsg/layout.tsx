'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
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
  ArrowLeft,
  ClipboardCheck,
  House,
  Monitor,
  ShieldCheck,
  Menu,
  X,
  Key,
} from 'lucide-react';

const navSections = [
  {
    label: 'Operate',
    items: [
      { label: 'Workspace', href: '/dsg/access', iconName: 'home' },
      { label: 'Workroom', href: '/dsg/workroom', iconName: 'workroom' },
      { label: 'Approvals', href: '/dsg/approvals', iconName: 'approvals' },
      { label: 'Verify', href: '/dsg/verify', iconName: 'verify' },
    ],
  },
  {
    label: 'Build',
    items: [
      { label: 'App Builder', href: '/dsg/app-builder', iconName: 'sparkles' },
      { label: 'Templates', href: '/dsg/templates', iconName: 'layoutTemplate' },
      { label: 'Flow Studio', href: '/dsg/flow-studio', iconName: 'gitBranch' },
    ],
  },
  {
    label: 'Manage',
    items: [
      { label: 'My Apps', href: '/dsg/action-layer', iconName: 'layoutGrid' },
      { label: 'History', href: '/dsg/history', iconName: 'history' },
      { label: 'API Keys', href: '/dsg/api-keys', iconName: 'key' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { label: 'Analytics', href: '/dsg/analytics', iconName: 'barChart2' },
      { label: 'Governance', href: '/dsg/governance', iconName: 'shield' },
      { label: 'Autonomous Level', href: '/dsg/autonomous-level', iconName: 'cpu' },
    ],
  },
];

const bottomItems = [
  { label: 'Notifications', href: '/dsg/notifications', iconName: 'bell' },
];

// Thumb-reach shortcuts on phones (same destinations as the menu); the fifth tab opens the full menu.
const mobileTabs = [
  { label: 'Workroom', href: '/dsg/workroom', iconName: 'workroom' },
  { label: 'Approvals', href: '/dsg/approvals', iconName: 'approvals' },
  { label: 'Verify', href: '/dsg/verify', iconName: 'verify' },
  { label: 'App Builder', href: '/dsg/app-builder', iconName: 'sparkles' },
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
    case 'home':           return <House className={cls} />;
    case 'workroom':       return <Monitor className={cls} />;
    case 'approvals':      return <ClipboardCheck className={cls} />;
    case 'verify':         return <ShieldCheck className={cls} />;
    case 'key':            return <Key className={cls} />;
    default:               return null;
  }
}

function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();

  return (
    // The global skin makes bg-slate-950 translucent; the phone drawer must be opaque.
    <aside className={`relative z-10 flex h-full w-64 max-w-[86vw] shrink-0 flex-col border-r border-slate-800 ${onClose ? 'bg-[#030a17]' : 'bg-slate-950'}`}>
      {/* logo row */}
      <div className="flex h-14 items-center justify-between border-b border-slate-800 px-4">
        <a
          href="/"
          className="flex min-h-11 items-center gap-2 text-xs font-black uppercase tracking-widest text-white"
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
            <p className="px-4 pb-1 pt-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
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

        {/* bottom */}
        <div className="mt-2 border-t border-slate-800 py-2">
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
      </nav>
    </aside>
  );
}

function MobileTabs({ menuOpen, onOpenMenu }: { menuOpen: boolean; onOpenMenu: () => void }) {
  const pathname = usePathname();
  const tab = 'flex min-h-14 flex-1 touch-manipulation flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cyan-300';

  return (
    <nav
      aria-label="DSG ONE shortcuts"
      className="dsg-sidebar-mobile-tabs flex shrink-0 border-t border-slate-800 bg-slate-950 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {mobileTabs.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/');
        return (
          <a
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`${tab} ${active ? 'text-indigo-300' : 'text-slate-400'}`}
          >
            <NavIcon name={item.iconName} />
            {item.label}
          </a>
        );
      })}
      <button
        type="button"
        onClick={onOpenMenu}
        aria-expanded={menuOpen}
        className={`${tab} text-slate-400`}
      >
        <Menu className="h-4 w-4" />
        Menu
      </button>
    </nav>
  );
}

export default function DsgLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-slate-950 text-slate-100">
      <a
        href="#dsg-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[60] focus:rounded-lg focus:bg-indigo-600 focus:px-3 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
      >
        Skip to content
      </a>

      {/* desktop sidebar */}
      <div className="dsg-sidebar-desktop hidden h-full md:flex">
        <Sidebar />
      </div>

      {/* mobile overlay */}
      {mobileOpen && (
        <div role="dialog" aria-modal="true" aria-label="DSG ONE menu" className="dsg-sidebar-mobile-overlay fixed inset-0 z-50 flex md:hidden">
          <Sidebar onClose={() => setMobileOpen(false)} />
          <div
            className="flex-1 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
        </div>
      )}

      {/* main area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="dsg-sidebar-mobile-header flex h-14 shrink-0 items-center border-b border-slate-800 px-4 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="ml-3 text-xs font-black uppercase tracking-widest text-white">
            DSG ONE
          </span>
        </div>
        <div id="dsg-main" tabIndex={-1} className="min-h-0 min-w-0 flex-1 overflow-y-auto focus:outline-none">
          {children}
        </div>
        <MobileTabs menuOpen={mobileOpen} onOpenMenu={() => setMobileOpen(true)} />
      </div>
    </div>
  );
}
