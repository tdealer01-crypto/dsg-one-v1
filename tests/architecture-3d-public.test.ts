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
    expect(html).toContain('VALID · 140 RECORDS');
    expect(html).toContain('OAuth → GitHub read-only → signed Ed25519 E2E');
    expect(html).toContain('VERIFIED · SCOPED PASS');
    expect(html).toContain('NOT VERIFIED');
    expect(html).toContain('Cinema remote Connect/Execute; Quest/Unity');
    expect(html).toContain('Spacetime Workroom store');
    expect(html).toContain('UNAVAILABLE');
    expect(html).toContain('Full-system Production E2E');
    expect(html).toContain('https://github.com/tdealer01-crypto/DSG-Private-Production-Runtime/actions/runs/38140811436');
  });

  it('links to the public route from the existing homepage', () => {
    expect(home).toContain('href="/architecture-3d.html"');
    expect(home).toContain('Explore the five trust domains in 3D.');
    expect(home).toContain('not live telemetry.');
    expect(home).toContain('Cinema browser Connect/Execute, Quest/Unity and whole-system E2E remain NOT VERIFIED');
  });
});
