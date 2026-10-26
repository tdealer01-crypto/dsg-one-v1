'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowUpRight, ChevronRight, Menu, Plus, Sparkles, X } from 'lucide-react';
import { DSG_NAVIGATION, dsgPageLocation, isDsgNavigationActive } from '@/lib/dsg/client/page-navigation';

function Navigation({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return <aside className="dsg-app-navigation">
    <div className="dsg-app-brand">
      <Link href="/" onClick={onNavigate} className="dsg-brand-link"><Sparkles aria-hidden="true" size={20} /> DSG ONE</Link>
      {onNavigate && <button type="button" onClick={onNavigate} aria-label="ปิดเมนู" className="dsg-icon-button"><X size={20} aria-hidden="true" /></button>}
    </div>
    <nav aria-label="เมนู DSG ONE" className="dsg-app-nav-items">
      {DSG_NAVIGATION.map(group => {
        const content = <div className="dsg-nav-links">{group.items.map(item => {
          const active = isDsgNavigationActive(pathname, item.href);
          return <Link key={item.href} href={item.href} prefetch={false} onClick={() => {
            // Reopening the same deep link must also reveal an intentionally
            // collapsed panel; it does not issue a provider operation.
            if (pathname === '/dsg/workroom' && item.href.includes('?tool=')) {
              const panel = document.getElementById('dsg-advanced-tools');
              if (panel instanceof HTMLDetailsElement) panel.open = true;
            }
            onNavigate?.();
          }}
            aria-current={active ? 'page' : undefined} className="dsg-nav-link">
            <span>{item.label}</span>{item.href === '/control/' && <ArrowUpRight size={14} aria-hidden="true" />}
          </Link>;
        })}</div>;
        return group.secondary
          ? <details key={group.label} className="dsg-nav-group" open={group.items.some(item => isDsgNavigationActive(pathname, item.href)) || undefined}>
              <summary>{group.label}</summary>{content}
            </details>
          : <section key={group.label} className="dsg-nav-group" aria-label={group.label}><h2>{group.label}</h2>{content}</section>;
      })}
    </nav>
    <div className="dsg-app-nav-footer"><Link href="/" onClick={onNavigate} className="dsg-nav-link"><ArrowLeft size={16} aria-hidden="true" /> หน้าหลัก</Link></div>
  </aside>;
}

export function DsgApplicationShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const location = dsgPageLocation(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (menuOpen && !node.open) node.showModal();
    if (!menuOpen && node.open) node.close();
  }, [menuOpen]);

  if (location.surface === 'public') return children;
  if (location.surface === 'preview') return <div className="dsg-preview-frame">
    <nav aria-label="นำทางพรีวิวแอป" className="dsg-preview-toolbar">
      <Link href="/dsg/app-builder" className="dsg-button-secondary"><ArrowLeft size={16} aria-hidden="true" /> กลับไปสร้างแอป</Link>
      <span>พรีวิวแอป</span><Link href="/dsg/history" className="dsg-text-link">ดูงานและหลักฐาน</Link>
    </nav>{children}
  </div>;

  return <div className="dsg-application">
    <a className="dsg-skip-link" href="#dsg-page-content">ข้ามไปเนื้อหาหลัก</a>
    <div className="dsg-sidebar-desktop dsg-desktop-navigation"><Navigation pathname={pathname} /></div>
    <dialog ref={dialog} id="dsg-navigation-dialog" aria-label="เมนู DSG ONE" aria-modal="true"
      className="dsg-navigation-dialog" onClose={() => { setMenuOpen(false); menuButton.current?.focus(); }}
      onClick={event => { if (event.target === event.currentTarget) setMenuOpen(false); }}>
      <Navigation pathname={pathname} onNavigate={() => setMenuOpen(false)} />
    </dialog>
    <div className="dsg-app-body">
      <header className="dsg-app-header">
        <button ref={menuButton} type="button" onClick={() => setMenuOpen(true)} aria-label="เปิดเมนู"
          aria-haspopup="dialog" aria-controls="dsg-navigation-dialog" aria-expanded={menuOpen}
          className="dsg-icon-button dsg-sidebar-mobile-header dsg-menu-toggle"><Menu size={20} aria-hidden="true" /></button>
        <nav aria-label="ตำแหน่งปัจจุบัน" className="dsg-breadcrumb"><Link href="/">DSG ONE</Link>
          <ChevronRight size={14} aria-hidden="true" /><span>{location.group}</span>
          <ChevronRight size={14} aria-hidden="true" /><span aria-current="page">{location.title}</span></nav>
        <Link href={pathname === '/dsg/workroom' ? '#dsg-chat-message' : '/dsg/workroom'} className="dsg-button-primary dsg-header-action">
          <Plus size={16} aria-hidden="true" /><span>{pathname === '/dsg/workroom' ? 'เริ่มสั่งงาน' : 'กลับไปทำงาน'}</span>
        </Link>
      </header>
      <div id="dsg-page-content" tabIndex={0} className="dsg-app-content">{children}</div>
    </div>
  </div>;
}
