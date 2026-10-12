import {describe, expect, it} from 'vitest';
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

const root = process.cwd();
const layout = readFileSync(join(root, 'app/dsg/layout.tsx'), 'utf8');
const css = readFileSync(join(root, 'app/globals.css'), 'utf8');

const block = (from: string, to: string) => layout.slice(layout.indexOf(from), layout.indexOf(to));
const hrefsIn = (text: string) => [...text.matchAll(/href:\s*'(\/dsg\/[^']+)'/g)].map((m) => m[1]);

const sections = block('const navSections', 'const bottomItems');
const bottom = block('const bottomItems', 'const mobileTabs');
const tabs = block('const mobileTabs', 'function NavIcon');

describe('/dsg navigation targets', () => {
  it('links only to pages that exist (no dead menu entries)', () => {
    const all = [...hrefsIn(sections), ...hrefsIn(bottom), ...hrefsIn(tabs)];
    expect(all.length).toBeGreaterThan(10);
    const missing = all.filter((href) => !existsSync(join(root, 'app', href, 'page.tsx')));
    expect(missing).toEqual([]);
  });

  it('has no /dsg/settings entry (there is no such page)', () => {
    expect(layout).not.toContain('/dsg/settings');
  });

  it('puts the core operator surfaces in the menu: workspace, workroom, approvals, verify', () => {
    const menu = hrefsIn(sections);
    for (const href of ['/dsg/access', '/dsg/workroom', '/dsg/approvals', '/dsg/verify']) {
      expect(menu).toContain(href);
    }
  });

  it('has no duplicate destinations in the menu', () => {
    const all = [...hrefsIn(sections), ...hrefsIn(bottom)];
    expect(new Set(all).size).toBe(all.length);
  });

  it('keeps the phone shortcut bar to four tabs, each also in the menu', () => {
    const shortcuts = hrefsIn(tabs);
    expect(shortcuts).toHaveLength(4);
    const menu = new Set(hrefsIn(sections));
    for (const href of shortcuts) expect(menu.has(href)).toBe(true);
  });

  it('shortcut bar uses native anchors and follows the drawer in the Android desktop-site fallback', () => {
    const bar = layout.slice(layout.indexOf('function MobileTabs'), layout.indexOf('export default function DsgLayout'));
    expect(bar).toContain('<a\n');
    expect(bar).not.toContain('<Link');
    expect(bar).toContain('min-h-14');
    expect(bar).toContain('dsg-sidebar-mobile-tabs');
    expect(css).toMatch(/\.dsg-sidebar-mobile-tabs\s*\{\s*display:\s*flex !important;/);
  });

  it('keeps the whole menu in one scroll region (no section clipped behind a fixed footer)', () => {
    const sidebar = layout.slice(layout.indexOf('function Sidebar'), layout.indexOf('function MobileTabs'));
    const navOpen = sidebar.indexOf('<nav ');
    const navClose = sidebar.indexOf('</nav>');
    expect(navOpen).toBeGreaterThan(-1);
    expect(sidebar.slice(navOpen, navClose)).toContain('bottomItems.map');
  });
});
