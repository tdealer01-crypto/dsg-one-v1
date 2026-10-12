import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const layout = readFileSync(join(root, 'app/dsg/layout.tsx'), 'utf8');
const css = readFileSync(join(root, 'app/globals.css'), 'utf8');

const entries = [
  ['/dsg/app-builder', 'App Builder'],
  ['/dsg/templates', 'Templates'],
  ['/dsg/flow-studio', 'Flow Studio'],
  ['/dsg/action-layer', 'My Apps'],
  ['/dsg/history', 'History'],
  ['/dsg/api-keys', 'API Keys'],
  ['/dsg/analytics', 'Analytics'],
  ['/dsg/governance', 'Governance'],
  ['/dsg/autonomous-level', 'Autonomous Level'],
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
