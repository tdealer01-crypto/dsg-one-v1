import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const landing = readFileSync(resolve(process.cwd(), 'app/page.tsx'), 'utf8');
const middleware = readFileSync(resolve(process.cwd(), 'middleware.ts'), 'utf8');

describe('DSG ONE production landing first-value flow', () => {
  it('starts a real governed task at the existing protected Workroom', () => {
    expect(landing).toContain('เริ่มสั่งงานผ่านแชท');
    expect(landing).toContain('href="/dsg/workroom"');
    expect(landing).toContain('href="/dsg/access"');
    expect(landing).toContain('href="/dsg/approvals"');
    expect(middleware).toContain("const PROTECTED_PREFIXES = ['/dsg', '/enterprise', '/generated-apps']");
  });

  it('exposes a real keyboard-accessible mobile navigation without JavaScript state', () => {
    expect(landing).toContain('<details className="group relative">');
    expect(landing).toContain('<summary');
    expect(landing).toContain('aria-label="Mobile navigation"');
    expect(landing).toContain('min-h-11');
    expect(landing).toContain('max-w-[calc(100vw-2rem)]');
  });

  it('retains production proof truth and does not claim provider E2E from device reachability', () => {
    expect(landing).toContain('<PublicProductionSnapshot />');
    expect(landing).toContain('ตรวจผลเมื่อโปรเซสทำงานเสร็จ');
    expect(landing).toContain('Production truth boundary: OAuth-bound signed read-only provider E2E');
    expect(landing).not.toContain('Native Desktop activation and device enrollment are pending.');
    expect(landing).toContain('Cinema browser Connect/Execute, Quest/Unity and whole-system E2E remain NOT VERIFIED');
    expect(landing).toContain('not live telemetry.');
  });
  it('shows a public, dated pilot verification report without upgrading member E2E claims', () => {
    const report = readFileSync(resolve(process.cwd(), 'public/pilot-verification-2026-10-24.md'), 'utf8');
    expect(landing).toContain('DSG ONE Supervised Trial');
    expect(landing).toContain('href="/pilot-verification-2026-10-24.md"');
    expect(landing).toContain('External member login/job E2E');
    expect(landing).toContain('remain NOT VERIFIED');
    expect(report).toContain('Evidence checkpoint:** 24 October 2026');
    expect(report).toContain('BLOCK / APPROVAL_REQUIRED');
    expect(report).toContain('Two-account data isolation');
    expect(report).toContain('**Partial Pass only.**');
    expect(report).not.toContain('Member Pilot E2E PASS');
  });

});
