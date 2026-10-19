import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../../middleware';

describe('owner approval callback without duplicate site login', () => {
  it('does not redirect the signed Auth0 code/state before client callback handling', () => {
    const req = new NextRequest('https://dsg.pics/dsg/approvals?code=sample-code&state=sample-state');
    const res = middleware(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-middleware-next')).toBe('1');
    expect(req.nextUrl.searchParams.get('code')).toBe('sample-code');
    expect(req.nextUrl.searchParams.get('state')).toBe('sample-state');
  });

  it('serves the human approver landing page without a Supabase cookie', () => {
    const res = middleware(new NextRequest('https://dsg.pics/dsg/approvals'));
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('keeps ordinary owner workspace pages behind the existing site login', () => {
    const res = middleware(new NextRequest('https://dsg.pics/dsg/autonomous-level'));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('does not unintentionally exempt descendant approval paths', () => {
    const res = middleware(new NextRequest('https://dsg.pics/dsg/approvals/private'));
    expect(res.headers.get('location')).toContain('/login');
  });
});
