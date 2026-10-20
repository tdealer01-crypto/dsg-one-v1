import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../../middleware';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const landing = read('app/page.tsx');
const access = read('app/dsg/access/page.tsx');
const workroom = read('app/dsg/workroom/page.tsx');
const remote = read('components/dsg-live-workroom.tsx');
const marketplace = read('lib/dsg/marketplace/readiness.ts');

describe('Cinema landing -> authenticated Workroom Browser Controls', () => {
  it('routes public landing and Access Hub to existing governed controls, not Evidence Console', () => {
    expect(landing).toContain("href: '/dsg/workroom?tool=browser'");
    expect(access).toContain("href: '/dsg/workroom?tool=browser'");
    expect(landing).toContain("title: 'Cinema Remote Browser'");
    expect(access).toContain("name: 'Cinema / Browser'");
    expect(landing).toContain('external: false');
    expect(access).toContain('Evidence & Conformance, not the Cinema viewer');
  });

  it('preserves the protected browser deep-link through the existing site login', () => {
    const response = middleware(new NextRequest('https://dsg.pics/dsg/workroom?tool=browser'));
    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).not.toBeNull();
    const target = new URL(location!);
    expect(target.pathname).toBe('/login');
    expect(target.searchParams.get('next')).toBe('/dsg/workroom?tool=browser');
  });

  it('opens advanced Browser Controls automatically and retains Auth0/Spacetime execution gates', () => {
    expect(workroom).toContain("get('tool') === 'browser'");
    expect(workroom).toContain('const [advancedOpen, setAdvancedOpen] = useState(() =>');
    expect(workroom).toContain('<details open={advancedOpen}');
    expect(workroom).toContain("document.getElementById('live-controls')?.scrollIntoView");
    expect(remote).toContain("get('tool') === 'browser'");
    expect(remote).toContain("const [tab, setTab] = useState<'agent' | 'browser' | 'desktop'>(() =>");
    expect(remote).toContain("const browserTarget = 'node.cinema-remote'");
    expect(remote).toContain("'browser.remote.connect'");
    expect(remote).toContain("'browser.remote.execute'");
    expect(remote).toContain('Evidence &amp; Conformance ↗ (ไม่ใช่ Cinema Viewer)');
  });

  it('keeps historical/blocked E2E honest and removes retired Vercel release instructions', () => {
    expect(landing).toContain('Cinema browser Connect/Execute, Quest/Unity and whole-system E2E remain NOT VERIFIED');
    expect(marketplace).toContain('Existing AWS immutable ECR Build');
    expect(marketplace).toContain('sourceBound/digestBound');
    expect(marketplace).not.toContain('Existing Vercel deployment proof');
  });
});
