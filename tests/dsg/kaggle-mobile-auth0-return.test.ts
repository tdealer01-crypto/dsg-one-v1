import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dsgAuth0ReturnTo } from '@/lib/dsg/user-bound/auth0-return-route';

const file = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('Kaggle mobile Auth0 owner start', () => {
  it('restores only exact Workroom tabs after signed Auth0 callback', () => {
    expect(dsgAuth0ReturnTo('/dsg/workroom')).toBe('/dsg/workroom');
    expect(dsgAuth0ReturnTo('/dsg/workroom?tool=agent-v0')).toBe('/dsg/workroom?tool=agent-v0');
    expect(dsgAuth0ReturnTo('/dsg/workroom?tool=browser')).toBe('/dsg/workroom?tool=browser');
    expect(dsgAuth0ReturnTo('/dsg/workroom?tool=desktop')).toBe('/dsg/workroom?tool=desktop');
    for (const bad of [
      'https://evil.example/dsg/workroom', '//evil.example', '/dsg/workroom?next=https://evil.example',
      '/dsg/workroom?tool=agent-v0&extra=1', '/dsg/approvals', null, {},
    ]) expect(dsgAuth0ReturnTo(bad)).toBeNull();
  });

  it('uses explicit Auth0 login before GPU when browser has no delegated session', () => {
    const c = file('components/dsg-kaggle-gpu-status.tsx');
    const bridge = file('app/dsg/autonomous-level/identity-bridge.tsx');
    expect(c).toContain('if (!await session.isAuthenticated())');
    expect(c).toContain('await signInForKaggle();');
    expect(c).toContain('getDsgBrowserSession().loginWithRedirect');
    expect(c).toContain("appState: { returnTo: '/dsg/workroom?tool=agent-v0' }");
    expect(c).toContain("AUTH0_REAUTH_REQUIRED");
    expect(c).toContain("KAGGLE_OWNER_NETWORK_UNAVAILABLE");
    expect(c).toContain("KAGGLE_OWNER_RESPONSE_UNREADABLE");
    expect(bridge).toContain('const returnTo = dsgAuth0ReturnTo(appState?.returnTo);');
    expect(bridge).toContain('if (returnTo) router.replace(returnTo);');
    expect(c).not.toContain('ไม่สามารถยืนยันเซสชันเจ้าของหรือเชื่อม Workflow ได้');
  });

  it('never automatically retries GPU after redirect or claims READY from owner dispatch', () => {
    const c = file('components/dsg-kaggle-gpu-status.tsx');
    expect(c).toContain("onClick={() => void (signInRequired ? signInForKaggle() : startFreeGpu())}");
    expect(c).toContain("gpu");
    expect(c).toContain('หลังเข้าสู่ระบบให้กดเปิด GPU อีกครั้ง');
    expect(c).toContain("res.ok");
    expect(c).toContain("KAGGLE_OWNER_DISPATCH_UNAVAILABLE");
    expect(c).not.toContain('localStorage');
  });
});
