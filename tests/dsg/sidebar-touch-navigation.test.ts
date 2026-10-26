import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DSG_NAVIGATION } from '../../lib/dsg/client/page-navigation';

const shell = readFileSync('components/dsg-application-shell.tsx', 'utf8');
const css = readFileSync('app/globals.css', 'utf8');
const root = readFileSync('app/layout.tsx', 'utf8');

describe('DSG navigation on touch and Android embedded browsers', () => {
  it('keeps every existing section URL reachable in the shared navigation', () => {
    const links = DSG_NAVIGATION.flatMap(group => group.items).map(item => item.href);
    for (const href of ['/dsg/workroom', '/dsg/app-builder', '/dsg/approvals', '/dsg/autonomous-level', '/dsg/governance', '/dsg/templates', '/dsg/flow-studio', '/dsg/action-layer', '/dsg/api-keys', '/dsg/history', '/dsg/analytics', '/dsg/notifications', '/dsg/access']) expect(links).toContain(href);
    expect(root).toContain('<DsgApplicationShell>{children}</DsgApplicationShell>');
    expect(shell).toContain('href={item.href}');
  });

  it('puts actual work first and keeps samples inside explicitly labelled panels', () => {
    expect(DSG_NAVIGATION[0].items[0].href).toBe('/dsg/workroom');
    for (const page of ['history', 'analytics', 'notifications']) {
      const source = readFileSync('app/dsg/' + page + '/page.tsx', 'utf8');
      expect(source.indexOf('<DsgWorkspaceActivity')).toBeLessThan(source.indexOf('<details className="dsg-example-panel"'));
      expect(source).toContain('ข้อมูลสาธิต');
    }
  });

  it('keeps the drawer and its links mounted while a client navigation closes the dialog', () => {
    expect(shell).toContain('<dialog ref={dialog}');
    expect(shell).not.toContain('{menuOpen &&');
    expect(shell).toContain('<Navigation pathname={pathname} onNavigate=');
    expect(shell).toContain('node.close()');
    // The shared agent SDK remains in module memory across client navigation.
    expect(shell).toContain("import Link from 'next/link'");
  });

  it('keeps touch size, keyboard focus and current-page semantics', () => {
    expect(shell).toContain("aria-current={active ? 'page' : undefined}");
    expect(css).toMatch(/\.dsg-nav-link\s*\{[^}]*min-height: 2\.75rem/);
    expect(css).toContain('a:focus-visible');
    expect(shell).toContain('aria-haspopup="dialog"');
    expect(shell).toContain('menuButton.current?.focus()');
  });

  it('keeps a usable drawer when Android requests a desktop-sized viewport', () => {
    expect(shell).toContain('dsg-sidebar-desktop');
    expect(shell).toContain('dsg-sidebar-mobile-header');
    expect(css).toMatch(/@media \(pointer: coarse\)[\s\S]*?\.dsg-sidebar-desktop \{ display: none !important/);
    expect(css).toContain('.dsg-sidebar-mobile-header { display: flex !important; }');
  });

  it('keeps desktop navigation and a constrained scroll area on fine-pointer devices', () => {
    expect(css).toMatch(/@media \(min-width: 1024px\)[\s\S]*?\.dsg-desktop-navigation \{ display: flex/);
    expect(css).toContain('.dsg-app-content { min-width: 0; min-height: 0; flex: 1; overflow: auto;');
    expect(shell).toContain('aria-label="เมนู DSG ONE"');
  });
});
