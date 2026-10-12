import {describe, expect, it} from 'vitest';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {
  DSG_BOTTOM_ITEMS,
  DSG_MOBILE_TABS,
  DSG_NAV_SECTIONS,
  allDsgNavItems,
  isNavActive,
} from '@/lib/dsg/ui/nav';

describe('/dsg navigation', () => {
  it('links only to pages that exist (no dead menu entries)', () => {
    const missing = allDsgNavItems()
      .filter((item) => !existsSync(join(process.cwd(), 'app', item.href, 'page.tsx')))
      .map((item) => item.href);
    expect(missing).toEqual([]);
  });

  it('puts the core operator surfaces in the menu: workspace, workroom, approvals, verify', () => {
    const hrefs = allDsgNavItems().map((item) => item.href);
    for (const href of ['/dsg/access', '/dsg/workroom', '/dsg/approvals', '/dsg/verify']) {
      expect(hrefs).toContain(href);
    }
  });

  it('has no duplicate destinations', () => {
    const hrefs = allDsgNavItems().map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('keeps the phone shortcut bar to four tabs (plus the menu button) and each is a real menu entry', () => {
    expect(DSG_MOBILE_TABS).toHaveLength(4);
    const hrefs = new Set(allDsgNavItems().map((item) => item.href));
    for (const tab of DSG_MOBILE_TABS) expect(hrefs.has(tab.href)).toBe(true);
  });

  it('every section and item has a label', () => {
    for (const section of DSG_NAV_SECTIONS) {
      expect(section.label.trim()).not.toBe('');
      for (const item of section.items) expect(item.label.trim()).not.toBe('');
    }
    for (const item of DSG_BOTTOM_ITEMS) expect(item.label.trim()).not.toBe('');
  });

  it('marks a page and its sub-pages active, but not a sibling with a shared prefix', () => {
    expect(isNavActive('/dsg/app-builder', '/dsg/app-builder')).toBe(true);
    expect(isNavActive('/dsg/app-builder/abc', '/dsg/app-builder')).toBe(true);
    expect(isNavActive('/dsg/app-builder-x', '/dsg/app-builder')).toBe(false);
    expect(isNavActive(null, '/dsg/app-builder')).toBe(false);
  });
});
