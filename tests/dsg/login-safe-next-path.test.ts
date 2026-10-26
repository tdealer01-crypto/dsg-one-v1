import { describe, expect, it } from 'vitest';
import { safeNextPath } from '../../lib/dsg/client/safe-next-path';

describe('DSG login continuation URL', () => {
  it('keeps the correct in-app Workroom/Cinema/Native destination with query and fragment', () => {
    expect(safeNextPath('/dsg/workroom?tool=browser#live-controls')).toBe('/dsg/workroom?tool=browser#live-controls');
    expect(safeNextPath('/dsg/workroom?tool=desktop')).toBe('/dsg/workroom?tool=desktop');
    expect(safeNextPath('/dsg/app-builder?template=saas-starter')).toBe('/dsg/app-builder?template=saas-starter');
    expect(safeNextPath('/dsg/approvals')).toBe('/dsg/approvals');
  });

  it('blocks external schemes, network paths and special-scheme backslash redirects', () => {
    for (const next of [null, '', 'https://evil.example/after-login', 'http://evil.example', 'javascript:alert(1)', '///evil.example', '//evil.example', '/\\evil.example', '/\n/evil.example', '/\t/evil.example']) {
      expect(safeNextPath(next)).toBe('/dsg/access');
    }
  });

  it('rejects suspicious controls but preserves encoded internal search parameters', () => {
    expect(safeNextPath('/dsg/workroom?tool=browser&note=%E0%B8%97%E0%B8%94%E0%B8%AA%E0%B8%AD%E0%B8%9A'))
      .toBe('/dsg/workroom?tool=browser&note=%E0%B8%97%E0%B8%94%E0%B8%AA%E0%B8%AD%E0%B8%9A');
    expect(safeNextPath('/dsg/workroom\r')).toBe('/dsg/access');
    expect(safeNextPath('/dsg/workroom\\..\\@evil.example')).toBe('/dsg/access');
  });
});
