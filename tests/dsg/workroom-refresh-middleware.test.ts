import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function visit(path: string, cookie?: string) {
  return middleware(new NextRequest('https://dsg.pics' + path, {
    headers: cookie ? { cookie } : {},
  }));
}

describe('Workroom site-session refresh entry guard', () => {
  it('lets only the client-only Workroom shell mount with a preexisting refresh cookie', () => {
    const res = visit('/dsg/workroom?tool=browser', 'sb-access-token=expired; sb-refresh-token=existing-refresh');
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('cache-control')).toBe('private, no-store');

    const trailing = visit('/dsg/workroom/?tool=desktop', 'sb-refresh-token=existing-refresh');
    expect(trailing.status).toBe(200);
  });

  it('preserves login redirect and exact tool deep-link for a real guest', () => {
    const res = visit('/dsg/workroom?tool=browser');
    expect(res.status).toBe(307);
    const next = new URL(res.headers.get('location')!);
    expect(next.pathname).toBe('/login');
    expect(next.searchParams.get('next')).toBe('/dsg/workroom?tool=browser');
  });

  it('does not widen refresh-cookie shell access to unrelated protected pages', () => {
    for (const path of ['/dsg/access', '/dsg/app-builder', '/enterprise', '/generated-apps']) {
      const res = visit(path, 'sb-refresh-token=existing-refresh');
      expect(res.status, path).toBe(307);
      expect(new URL(res.headers.get('location')!).pathname).toBe('/login');
    }
  });

  it('requires real server-side reauthentication for workspace data and tools', () => {
    const workroom = readFileSync(join(process.cwd(), 'app/dsg/workroom/page.tsx'), 'utf8');
    const refresh = readFileSync(join(process.cwd(), 'app/api/auth/refresh/route.ts'), 'utf8');
    const userTools = readFileSync(join(process.cwd(), 'app/api/dsg/spacetime/user-tools/route.ts'), 'utf8');
    expect(workroom).toContain("fetch('/api/dsg/access/session'");
    expect(workroom).toContain("fetch('/api/auth/refresh'");
    expect(refresh).toContain("request.cookies.get('sb-refresh-token')");
    expect(refresh).toContain('httpOnly: true');
    expect(userTools).toContain('requireVerifiedDsgActor');
  });
});
