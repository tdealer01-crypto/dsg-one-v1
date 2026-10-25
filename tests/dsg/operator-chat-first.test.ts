import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isWorkDirective } from '@/components/dsg-operator-chat';

const root = process.cwd();
const component = readFileSync(join(root, 'components/dsg-operator-chat.tsx'), 'utf8');
const workroom = readFileSync(join(root, 'app/dsg/workroom/page.tsx'), 'utf8');
const layout = readFileSync(join(root, 'app/dsg/layout.tsx'), 'utf8');

describe('DSG ONE natural-language chat-first workroom', () => {
  it('recognizes action requests but does not queue explanatory questions', () => {
    expect(isWorkDirective('แก้ไขหน้าเว็บ DSG ONE ให้ใช้ง่ายขึ้น')).toBe(true);
    expect(isWorkDirective('ช่วยสร้างแอปใหม่ให้หน่อย')).toBe(true);
    expect(isWorkDirective('ตรวจสอบเว็บไซต์')).toBe(true);
    expect(isWorkDirective('ทำไม Build ไม่ผ่าน?')).toBe(false);
    expect(isWorkDirective('สวัสดี')).toBe(false);
    expect(isWorkDirective('สร้างแอปยังไง?')).toBe(false);
  });

  it('does not block future chat messages while a reply or job is pending', () => {
    expect(component).toContain('void answer(value, answerId, previousHistory)');
    expect(component).toContain('if (isTask) void createDurableJob(value, jobReplyId)');
    expect(component).toContain('pendingReplies');
    expect(component).not.toContain('disabled={pendingReplies');
    expect(component).toContain('setDraft(\'\')');
  });

  it('creates durable work items but never calls provider execute directly', () => {
    expect(component).toContain("fetch('/api/dsg/jobs'");
    expect(component).toContain("fetch('/api/dsg/agent-chat'");
    expect(component).toContain("method: 'POST', credentials: 'include'");
    expect(component).not.toContain('spacetime_execute');
    expect(component).not.toContain('START_ALLOWED');
    expect(component).toContain('การรับงานไม่เท่ากับ Execute สำเร็จ');
    expect(component).not.toContain('/dsg/jobs/${encodeURIComponent');
  });

  it('refreshes real job status, not client-side fake progress', () => {
    expect(component).toContain('window.setInterval(() => void refreshJobs(), 12000)');
    expect(component).toContain('setJobs(payload.data.jobs)');
    expect(component).toContain('displayStatus(job)');
    expect(component).not.toContain('Math.random');
  });

  it('presents one chat surface and loads advanced tools only when opened', () => {
    expect(workroom).toContain('<DsgOperatorChat key={selected.workspace_id} />');
    expect(workroom).toContain('advancedOpen && (');
    expect(workroom).toContain('<DsgLiveWorkroom key={selected.workspace_id} />');
    expect(layout).toContain('return children;');
    expect(readFileSync(join(root, 'app/layout.tsx'), 'utf8')).toContain('<DsgApplicationShell>{children}</DsgApplicationShell>');
  });
});
