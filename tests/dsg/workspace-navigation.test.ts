import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DSG_NAVIGATION, dsgPageLocation, isDsgNavigationActive } from '../../lib/dsg/client/page-navigation';
import { activityCategory, activityStatus, readWorkspaceJobs } from '../../lib/dsg/client/workspace-activity';

function pages(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? pages(join(directory, entry.name)) : entry.name === 'page.tsx' ? [join(directory, entry.name)] : []);
}

describe('shared page navigation', () => {
  it('gives every owned application page a named route and a route back to work', () => {
    const ownedPages = pages('app').map(path => '/' + path.replace(/^app\//, '').replace(/\/page\.tsx$/, ''))
      .filter(path => !['/page.tsx', '/login', '/remote-browser-execution'].includes(path) && !path.startsWith('/generated-apps/'));
    for (const path of ownedPages) {
      const location = dsgPageLocation(path);
      expect(location.surface, path).toBe('workspace');
      expect(location.title, path).not.toBe('DSG ONE');
      expect(location.group, path).toBeTruthy();
    }
    expect(DSG_NAVIGATION.flatMap(group => group.items).some(item => item.href === '/dsg/workroom')).toBe(true);
  });

  it('selects one deepest destination for nested template and job pages', () => {
    const links = DSG_NAVIGATION.flatMap(group => group.items);
    for (const path of ['/dsg/templates', '/dsg/templates/my', '/dsg/templates/my-payouts', '/dsg/app-builder/job-123', '/dsg/app-builder/sandbox']) {
      const current = links.filter(item => isDsgNavigationActive(path, item.href));
      expect(current, path).toHaveLength(1);
      expect(current[0].href).toBe(path.includes('job-123') ? '/dsg/app-builder' : path);
    }
  });

  it('keeps public entry and customer app previews separate from workspace styling', () => {
    for (const path of ['/', '/login', '/remote-browser-execution']) expect(dsgPageLocation(path).surface).toBe('public');
    expect(dsgPageLocation('/generated-apps/customer-app').surface).toBe('preview');
  });
});

describe('actual workspace activity', () => {
  it('distinguishes an empty successful read from unavailable or malformed data', () => {
    expect(readWorkspaceJobs({ ok: true, data: { jobs: [] } })).toEqual([]);
    for (const value of [null, {}, { ok: false, data: { jobs: [] } }, { ok: true, data: { jobs: [{ id: 'x', status: 'COMPLETE' }] } }]) {
      expect(() => readWorkspaceJobs(value)).toThrow();
    }
  });

  it('does not turn a database completion status into verified execution', () => {
    const job = { id: 'job-1', goal: 'Do the work', status: 'COMPLETED' };
    expect(activityStatus(job)).toContain('ยังไม่มีรายงานยืนยัน');
    expect(activityCategory(job)).toBe('pending');
    expect(activityStatus({ ...job, completionReportId: 'report-1' })).toBe('มีรายงานผล · เปิดตรวจหลักฐาน');
  });

  it('keeps failed and awaiting-approval jobs visible for follow-up even when a report exists', () => {
    for (const status of ['AWAITING_APPROVAL', 'FAILED', 'BLOCKED', 'REJECTED']) {
      expect(activityCategory({ id: 'job-1', goal: 'Do the work', status, completionReportId: 'report-1' })).toBe('attention');
    }
    expect(activityCategory({ id: 'job-2', goal: 'Do the work', status: 'RUNNING' })).toBe('running');
  });
});
