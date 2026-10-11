import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const html = readFileSync(resolve(process.cwd(), 'public/architecture-3d.html'), 'utf8');
const home = readFileSync(resolve(process.cwd(), 'app/page.tsx'), 'utf8');

describe('public interactive DSG architecture', () => {
  it('serves a standalone, interactive HTML document without app-specific assets', () => {
    expect(html).toContain('<canvas id="architecture"');
    expect(html).toContain('data-domain="4"');
    expect(html).toContain('<script>');
    expect(html).not.toMatch(/<script[^>]+src=|<link[^>]+stylesheet/);
    expect(html).toContain('https://dsg.pics/architecture-3d.html');
  });

  it('publishes dated verified AWS image status without claiming full E2E success', () => {
    expect(html).toContain('VERIFIED · 11 OCT 2026');
    expect(html).toContain('VALID · 137 RECORDS');
    expect(html).toContain('ChatGPT user OAuth → provider E2E');
    expect(html).toContain('NOT VERIFIED');
    expect(html).toContain('Spacetime Workroom state');
    expect(html).toContain('UNAVAILABLE');
    expect(html).toContain('Full-system Production E2E');
    expect(html).toContain('https://dsg-3.gitbook.io/dsg-docs/control-plane/');
  });

  it('links to the public route from the existing homepage', () => {
    expect(home).toContain('href="/architecture-3d.html"');
    expect(home).toContain('Explore the five trust domains in 3D.');
    expect(home).toContain('Not live telemetry.');
  });
});
