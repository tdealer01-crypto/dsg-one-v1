import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { safeWorkroomEventSummary, summarizeWorkroomTimeline } from '@/lib/dsg/client/workroom-job-summary';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('DSG Workroom inline job evidence — read-only', () => {
  it('does not treat a completed job with no report as verified', () => {
    const result = summarizeWorkroomTimeline({ job: { status: 'COMPLETED' }, events: [{}] });
    expect(result.verified).toBe(false);
    expect(result.completionReports).toBe(0);
    expect(result.userMessage).toContain('ยังไม่พบรายงาน');
  });
  it('counts real report/evidence collections without asserting signed verification', () => {
    const result = summarizeWorkroomTimeline({ job: { status: 'SUCCESS' }, evidenceItems: [{ id: '1' }], completionReports: [{}], replayProofs: [{}] });
    expect(result.evidenceItems).toBe(1);
    expect(result.completionReports).toBe(1);
    expect(result.replayProofs).toBe(1);
    expect(result.verified).toBe(false);
  });
  it('keeps approval inside the existing protected approval flow', () => {
    const result = summarizeWorkroomTimeline({ job: { status: 'WAITING_APPROVAL' } });
    expect(result.nextAction).toContain('MFA');
    const view = source('components/dsg-job-inspector.tsx');
    expect(view).toContain('href="/dsg/approvals"');
    expect(view).not.toContain('spacetime_execute');
    expect(view).not.toContain("method: 'POST'");
  });
  it('fails closed on malformed responses and does not expose raw event JSON', () => {
    const result = summarizeWorkroomTimeline({ events: 'untrusted', completionReports: 40 });
    expect(result.completionReports).toBe(0);
    expect(result.verified).toBe(false);
    expect(safeWorkroomEventSummary({ access_token: 'secret-value', type: 'Step started' })).toBe('Step started');
    expect(safeWorkroomEventSummary({ access_token: 'secret-value' })).not.toContain('secret-value');
  });
  it('reuses authenticated job timeline API and keeps the existing chat endpoints', () => {
    const view = source('components/dsg-job-inspector.tsx');
    const chat = source('components/dsg-operator-chat.tsx');
    expect(view).toContain('encodeURIComponent(jobId)');
    expect(view).toContain("credentials: 'include', cache: 'no-store'");
    expect(chat).toContain("fetch('/api/dsg/jobs'");
    expect(chat).toContain("fetch('/api/dsg/agent-chat'");
  });
});
