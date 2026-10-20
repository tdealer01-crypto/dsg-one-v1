import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const page = read('app/page.tsx');
const login = read('app/login/page.tsx');
const workroom = read('app/dsg/workroom/page.tsx');
const chat = read('components/dsg-operator-chat.tsx');
const live = read('components/dsg-live-workroom.tsx');

describe('Customer-first UX and Native Shell handoff', () => {
  it('keeps one main chat and directly navigates to Native and Cinema', () => {
    expect(page).toContain("href: '/dsg/workroom?tool=desktop'");
    expect(page).toContain("href: '/dsg/workroom?tool=browser'");
    expect(page).toContain('รายการรออนุมัติ');
    expect(workroom).toContain('<DsgOperatorChat key={selected.workspace_id} />');
    expect(workroom).toContain('id="dsg-advanced-tools"');
    expect(chat).toContain('id="dsg-jobs"');
  });

  it('retains the selected route across site login and Auth0 login', () => {
    expect(workroom).toContain('window.location.pathname + window.location.search');
    expect(workroom).toContain("'/login?next=' + encodeURIComponent(returnTo)");
    expect(live).toContain("appState: { returnTo: window.location.pathname + window.location.search }");
    expect(live).toContain("next.searchParams.set('tool', item)");
    expect(login).toContain('เข้าสู่ระบบเพื่อทำงานต่อ');
    expect(login).toContain('window.location.assign(nextPath)');
  });

  it('uses existing Auth0, governed plan and one exact human signed permit for Native Shell', () => {
    expect(live).toContain("const desktopTarget = 'node.desktop-native'");
    expect(live).toContain("run('device.shell.exec', desktopTarget");
    expect(live).toContain("tool('spacetime_request_approval'");
    expect(live).toContain("tool('spacetime_claim_approval'");
    expect(live).toContain("tool('spacetime_execute'");
    expect(live).toContain("tool('spacetime_verify_evidence'");
    expect(live).toContain('workroomReceiptMatches(data.receipt, request, approvalId)');
    expect(live).not.toContain('node.rdc-remote');
    expect(live).not.toContain('localStorage.setItem');
    expect(live).not.toContain('sessionStorage.setItem');
  });

  it('reports process start as running, not successful completion', () => {
    expect(live).toContain('operation.running === true');
    expect(live).toContain('operation.returncode === 0');
    expect(live).toContain("capability: 'device.process.list'");
    expect(live).toContain("entry?.process_id === expectedProcessId");
    expect(live).toContain('ตรวจผลคำสั่งเดิม (ไม่รันซ้ำ)');
    expect(live).toContain('คำสั่งเสร็จสำเร็จ (exit code 0)');
  });

  it('gives useful customer navigation and keeps technical receipts behind details', () => {
    expect(workroom).toContain('ทางลัดการทำงาน');
    expect(workroom).toContain('3. อนุมัติเมื่อจำเป็น');
    expect(live).toContain('รายละเอียดเทคนิคของคำขอ');
    expect(live).toContain('ดูผล Provider และ Evidence (ขั้นสูง)');
  });
});
