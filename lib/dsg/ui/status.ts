// One vocabulary for "did it pass?" across the product. Unknown values are neutral — never
// rendered as a pass — so a typo or a new backend status cannot look like success.
export type StatusTone = 'pass' | 'fail' | 'blocked' | 'pending' | 'review' | 'neutral';

const TONE_BY_STATUS: Record<string, StatusTone> = {
  PASS: 'pass',
  PASSED: 'pass',
  VERIFIED: 'pass',
  DEPLOYED: 'pass',
  FAIL: 'fail',
  FAILED: 'fail',
  ERROR: 'fail',
  REJECTED: 'fail',
  BLOCK: 'blocked',
  BLOCKED: 'blocked',
  DENIED: 'blocked',
  PENDING: 'pending',
  BUILDING: 'pending',
  RUNNING: 'pending',
  QUEUED: 'pending',
  IN_PROGRESS: 'pending',
  WARN: 'review',
  WARNING: 'review',
  REVIEW: 'review',
  NOT_VERIFIED: 'review',
  APPROVAL_REQUIRED: 'review',
  PARTIAL: 'review',
};

export const STATUS_TONE_GLOSS: Record<StatusTone, string> = {
  pass: 'ผ่าน',
  fail: 'ไม่ผ่าน',
  blocked: 'ถูกบล็อก',
  pending: 'รอดำเนินการ',
  review: 'ต้องตรวจสอบ',
  neutral: '',
};

export function normalizeStatus(raw: string | null | undefined): string {
  return (raw ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}

export function toStatusTone(raw: string | null | undefined): StatusTone {
  return TONE_BY_STATUS[normalizeStatus(raw)] ?? 'neutral';
}
