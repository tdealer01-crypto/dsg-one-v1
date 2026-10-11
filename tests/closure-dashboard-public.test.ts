import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const closure = readFileSync(resolve(process.cwd(), 'public/closure-dashboard.html'), 'utf8');
const homepage = readFileSync(resolve(process.cwd(), 'app/page.tsx'), 'utf8');
const architecture = readFileSync(resolve(process.cwd(), 'public/architecture-3d.html'), 'utf8');

describe('Public DSG ONE closure checklist', () => {
  it('preserves the user-provided interactive dashboard as standalone static HTML', () => {
    expect(closure).toContain('<div id="root"></div>');
    expect(closure).toContain('<script type="module">');
    expect(closure).toContain('DSG ONE — 1-2-3 Closure Checklist');
    expect(closure).not.toMatch(/<script[^>]+src=/);
  });

  it('labels manually checked gate status as local self-assessment, not live system proof', () => {
    expect(closure).toContain('local self-assessment checklist');
    expect(closure).toContain('SELF-CHECKED');
    expect(closure).toContain('NOT VERIFIED');
    expect(closure).toContain('LOCAL CHECKLIST GRAPH');
    expect(closure).not.toContain('✓ LIVE E2E VERIFIED');
    expect(closure).not.toContain('READY FOR DEVPOST');
    expect(closure).toContain('NOT AUDIT EVIDENCE');
    expect(closure).toContain('https://dsg-3.gitbook.io/dsg-docs/control-plane/');
  });

  it('links from the existing public home and 3D architecture without new login requirements', () => {
    expect(homepage).toContain('href="/closure-dashboard.html"');
    expect(architecture).toContain('href="/closure-dashboard.html"');
    expect(closure).toContain('href="/architecture-3d.html"');
    expect(homepage).toContain('/login?next=/dsg/access');
  });
});
