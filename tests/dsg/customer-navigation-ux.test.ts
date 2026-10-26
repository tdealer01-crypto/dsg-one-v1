import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
describe('customer journey on Android', () => {
  it('preserves the exact tool deep link across site sign-in', () => {
    const page = source('app/dsg/workroom/page.tsx');
    expect(page).toContain('window.location.pathname + window.location.search');
    expect(page).toContain("window.location.assign('/login?next=' + encodeURIComponent(returnTo))");
    expect(page).toContain("['browser', 'desktop']");
    expect(source('app/login/page.tsx')).toContain('window.location.assign(nextPath)');
  });
  it('shows chat, jobs, approval and devices without extra technical setup', () => {
    const page = source('app/dsg/workroom/page.tsx');
    const chat = source('components/dsg-operator-chat.tsx');
    expect(page).toContain('1. สั่งงาน');
    expect(page).toContain('2. ติดตามงาน');
    expect(page).toContain('3. อนุมัติเมื่อจำเป็น');
    expect(page).toContain('เครื่องที่เชื่อมต่อ');
    expect(chat).toContain('id="dsg-jobs"');
    expect(page).toContain('<DsgOperatorChat key={selected.workspace_id} />');
  });
  it('keeps native approvals exact and never dispatches Shell while approval is pending', () => {
    const ui = source('components/dsg-live-workroom.tsx');
    expect(ui).toContain("tool('spacetime_request_approval'");
    expect(ui).toContain("tool('spacetime_claim_approval'");
    expect(ui).toContain("tool('spacetime_execute'");
    expect(ui).toContain("tool('spacetime_verify_evidence'");
    expect(ui).toContain('if (claim.receipt?.verdict !==');
    expect(ui).toContain('setPending(null)');
    expect(ui).toContain("nativeShellOutcome(");
    expect(ui).toContain("capability: 'device.process.list'");
    expect(ui).not.toContain('node.rdc-remote');
    expect(ui).not.toContain('localStorage.setItem');
  });
});
