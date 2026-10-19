import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const layout = readFileSync(join(root, 'app/dsg/layout.tsx'), 'utf8');
const css = readFileSync(join(root, 'app/globals.css'), 'utf8');

const entries = [
  ['/dsg/workroom', 'คุยกับ DSG ONE'],
  ['/dsg/app-builder', 'สร้างแอป · App Builder'],
  ['/dsg/approvals', 'คำขออนุมัติ · Approvals'],
  ['/dsg/autonomous-level', 'รายงานความสามารถ'],
  ['/dsg/governance', 'Governance · อ้างอิง'],
  ['/dsg/templates', 'Templates · คลังตัวอย่าง'],
  ['/dsg/flow-studio', 'Flow Studio · วางแผน'],
  ['/dsg/action-layer', 'Agent Nexus · Telemetry'],
  ['/dsg/api-keys', 'API Keys'],
  ['/dsg/history', 'History · ข้อมูลตัวอย่าง'],
  ['/dsg/analytics', 'Analytics · ข้อมูลตัวอย่าง'],
  ['/dsg/notifications', 'Notifications · ข้อมูลตัวอย่าง'],
];

describe('DSG navigation on touch and Android embedded browsers', () => {
  it('keeps every existing section URL and lets the browser do an actual navigation', () => {
    for (const [href, label] of entries) {
      expect(layout).toContain(`label: '${label}', href: '${href}'`);
    }
    expect(layout).toContain('<a\n');
    expect(layout).toContain('href={item.href}');
    expect(layout).not.toContain("import Link from 'next/link'");
    expect(layout).not.toContain('<Link');
  });

  it('puts the real work surfaces first and hides sample views in secondary navigation', () => {
    const primary = layout.slice(layout.indexOf('const navSections = ['),
      layout.indexOf('const advancedItems = ['));
    const secondary = layout.slice(layout.indexOf('const advancedItems = ['),
      layout.indexOf('const bottomItems = ['));
    expect(primary).toContain("href: '/dsg/workroom'");
    expect(primary).toContain("label: 'คุยกับ DSG ONE'");
    expect(primary).not.toContain("href: '/dsg/app-builder'");
    expect(primary).not.toContain("href: '/dsg/approvals'");
    expect(secondary).toContain("href: '/dsg/app-builder'");
    expect(secondary).toContain("href: '/dsg/approvals'");
    expect(primary).not.toContain("href: '/dsg/history'");
    expect(primary).not.toContain("href: '/dsg/analytics'");
    expect(primary).not.toContain("label: 'My Apps'");
    expect(secondary).toContain('History · ข้อมูลตัวอย่าง');
    expect(secondary).toContain('Analytics · ข้อมูลตัวอย่าง');
    expect(secondary).toContain('Agent Nexus · Telemetry');
    expect(layout).toContain('<details open={advancedItems.some(');
  });

  it('does not unmount a mobile menu link during the Next router click', () => {
    // Native href navigation carries the real user cookie and works even if
    // the SPA router cannot handle a Custom Tab's onClick/route transition.
    const menuLink = layout.match(/<a\s+key=\{item.label\}[\s\S]*?<\/a>/)?.[0];
    expect(menuLink).toContain('href={item.href}');
    expect(menuLink).not.toContain('onClick={onClose}');
  });

  it('makes nav links touch sized with keyboard focus and active semantics', () => {
    expect(layout).toContain('min-h-11 touch-manipulation');
    expect(layout).toContain("aria-current={active ? 'page' : undefined}");
    expect(layout).toContain('focus-visible:outline-2');
  });

  it('forces mobile drawer when Android requests desktop-sized CSS viewport', () => {
    expect(layout).toContain('dsg-sidebar-desktop');
    expect(layout).toContain('dsg-sidebar-mobile-header');
    expect(layout).toContain('dsg-sidebar-mobile-overlay');
    expect(css).toContain('@media (pointer: coarse)');
    expect(css).toContain('.dsg-sidebar-desktop');
    expect(css).toContain('display: none !important');
    expect(css).toContain('.dsg-sidebar-mobile-header');
    expect(css).toContain('display: flex !important');
  });

  it('keeps desktop browser side navigation for pointer:fine devices', () => {
    expect(layout).toContain('hidden h-full md:flex');
    expect(layout).toContain('aria-label="DSG ONE sections"');
    expect(layout).toContain('min-w-0 flex-1');
  });
});
