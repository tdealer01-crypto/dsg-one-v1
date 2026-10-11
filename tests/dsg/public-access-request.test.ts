import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {ACCESS_REQUEST_EMAIL, accessRequestMailto} from '@/lib/dsg/public/access-request';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('new visitors can request access by email', () => {
  it('builds a mailto link with a Thai subject and a body template', () => {
    const href = accessRequestMailto();
    expect(href.startsWith(`mailto:${ACCESS_REQUEST_EMAIL}?`)).toBe(true);
    const params = new URLSearchParams(href.split('?')[1]);
    expect(params.get('subject')).toBe('ขอสิทธิ์ใช้งาน DSG ONE');
    expect(params.get('body')).toContain('อีเมลที่จะใช้ล็อกอิน');
  });

  it('offers the request on the landing page and on the sign-in page (no dead end)', () => {
    expect(read('app/page.tsx')).toContain('accessRequestMailto()');
    expect(read('app/login/page.tsx')).toContain('accessRequestMailto()');
  });

  it('shows an illustrative sample receipt that is labelled as such and has no invented hash', () => {
    const home = read('app/page.tsx');
    const start = home.indexOf('id="sample-receipt"');
    expect(start).toBeGreaterThan(-1);
    const section = home.slice(start, start + 3000);
    expect(section).toContain('ไม่ใช่ผลจริง');
    expect(section).not.toMatch(/[0-9a-f]{64}/i);
  });

  it('gives the home page a descriptive Thai title and keeps the sign-in route', () => {
    const home = read('app/page.tsx');
    expect(home).toMatch(/export const metadata/);
    expect(home).toContain('ตรวจสอบก่อนให้ AI ลงมือทำ');
    expect(home).toContain('/login?next=/dsg/access');
  });
});
