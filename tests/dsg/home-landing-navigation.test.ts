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
    expect(landing).toContain('Online alone is not proof of a complete job.');
    expect(landing).not.toContain('Native Desktop activation and device enrollment are pending.');
    expect(landing).toContain('Cinema browser Connect/Execute, Quest/Unity and whole-system E2E remain NOT VERIFIED');
    expect(landing).toContain('not live telemetry.');
  });
});
