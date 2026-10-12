import { describe, expect, it } from 'vitest';
import { sessionLoadFailure, workspaceActivationFailure } from '@/lib/dsg/ui/session-notices';

// The raw body of a failed route is never shown; the user gets what happened (HTTP code) and what to do next.
describe('session / workspace failure notices', () => {
  it('a session load failure names the HTTP code and the retry step', () => {
    const text = sessionLoadFailure(500);
    expect(text).toContain('ไม่สำเร็จ');
    expect(text).toContain('HTTP 500');
    expect(text).toContain('Refresh');
  });

  it('a network failure (no HTTP status) says the server could not be reached, not a made-up code', () => {
    const text = sessionLoadFailure(null);
    expect(text).toContain('ไม่สำเร็จ');
    expect(text).not.toMatch(/HTTP \d/);
    expect(workspaceActivationFailure(null)).not.toMatch(/HTTP \d/);
  });

  it('workspace activation distinguishes "not a member" (403) and "session expired" (401) from other errors', () => {
    expect(workspaceActivationFailure(403)).toContain('ไม่ได้เป็นสมาชิก');
    expect(workspaceActivationFailure(401)).toContain('เซสชันหมดอายุ');
    expect(workspaceActivationFailure(502)).toContain('HTTP 502');
    for (const status of [null, 401, 403, 500, 502]) expect(workspaceActivationFailure(status)).toContain('ไม่สำเร็จ');
  });
});
