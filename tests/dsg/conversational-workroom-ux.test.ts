import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const page = read('app/dsg/workroom/page.tsx');
const chat = read('components/dsg-conversational-workspace.tsx');
const nav = read('app/dsg/layout.tsx');

describe('DSG ONE user-facing conversational workroom', () => {
  it('makes conversation primary and keeps technical controls collapsed', () => {
    expect(page).toContain('<DsgConversationalWorkspace');
    expect(page).toContain('<summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-slate-300">เครื่องมือขั้นสูงสำหรับผู้ดูแล</summary>');
    expect(page).toContain('<DsgLiveWorkroom');
    expect(page.indexOf('<DsgConversationalWorkspace')).toBeLessThan(page.indexOf('<DsgLiveWorkroom'));
    const top = nav.slice(nav.indexOf('const navSections = ['), nav.indexOf('const advancedItems = ['));
    expect(top).toContain("href: '/dsg/workroom'");
    expect(top).not.toContain("href: '/dsg/approvals'");
    expect(top).not.toContain("href: '/dsg/analytics'");
  });

  it('lets user send another message while earlier replies or jobs are pending', () => {
    expect(chat).toContain("async function submit(mode: 'chat' | 'task')");
    expect(chat).toContain("fetch('/api/dsg/agent-chat'");
    expect(chat).toContain("fetch('/api/dsg/jobs'");
    expect(chat).toContain('setTurns(items => [...items, turn])');
    expect(chat).not.toContain('busyRef');
    expect(chat).not.toContain('disabled={busy}');
    expect(chat).not.toContain('disabled={submittingTasks > 0}');
  });

  it('only reports persisted provider state; a submitted job is not called executed', () => {
    expect(chat).toContain("fetch('/api/dsg/jobs', { credentials: 'include', cache: 'no-store' })");
    expect(chat).toContain("const COMPLETED = new Set");
    expect(chat).toContain('job.completionReportId');
    expect(chat).toContain('บันทึกงานแล้ว · รอเริ่มดำเนินการ');
    expect(chat).toContain('Durable recording is NOT proof that a provider has started running');
    expect(chat).toContain('data.data?.fallback');
    expect(chat).not.toContain('localStorage.setItem');
  });

  it('does not add a second login or approval mechanism to the new conversation', () => {
    expect(chat).not.toContain('loginWithRedirect');
    expect(chat).not.toContain('spacetime_resolve_approval');
    expect(chat).not.toContain('DSG_WORKROOM_ACCESS_KEY');
    expect(chat).toContain("credentials: 'include'");
  });
});
