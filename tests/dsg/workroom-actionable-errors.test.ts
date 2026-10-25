import { describe, expect, it } from 'vitest';
import { describeWorkroomFailure } from '@/lib/dsg/user-bound/workroom-failure';

describe('Workroom errors communicate the specific next action', () => {
  it('does not convert pending human approval into failure or resubmission', () => {
    expect(describeWorkroomFailure(new Error('HUMAN_APPROVAL_NOT_READY'))).toContain('คำขอเดิม');
    expect(describeWorkroomFailure(new Error('APPROVAL_PENDING'))).toContain('ไม่ต้องส่งงานใหม่');
  });
  it('distinguishes route and provider errors from an approval issue', () => {
    expect(describeWorkroomFailure(new Error('EXECUTION_FAILED:CINEMA_ACTION_NOT_ALLOWED'))).toContain('Payload');
    expect(describeWorkroomFailure(new Error('CINEMA_HTTP_503'))).toContain('Provider');
    expect(describeWorkroomFailure(new Error('DSG_NATIVE_DESKTOP_NOT_ENROLLED'))).toContain('จับคู่');
  });
  it('redacts unbounded provider text that may contain credentials', () => {
    const value = describeWorkroomFailure(new Error('secret=do-not-echo Authorization Bearer token'));
    expect(value).not.toContain('do-not-echo');
    expect(value).toContain('ยังไม่ผ่าน');
  });
  it('keeps invalid or absent Auth0 tokens separate from site membership', () => {
    expect(describeWorkroomFailure(new Error('AUTH0_REAUTH_REQUIRED'))).toContain('Auth0');
    expect(describeWorkroomFailure(new Error('DSG_WORKSPACE_SESSION_REQUIRED'))).toContain('Workspace');
  });
});
