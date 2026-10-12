import {describe, expect, it} from 'vitest';
import {STATUS_TONE_GLOSS, normalizeStatus, toStatusTone} from '@/lib/dsg/ui/status';

describe('status vocabulary', () => {
  it('maps the four gate states the product shows', () => {
    expect(toStatusTone('PASS')).toBe('pass');
    expect(toStatusTone('FAILED')).toBe('fail');
    expect(toStatusTone('FAIL')).toBe('fail');
    expect(toStatusTone('BLOCKED')).toBe('blocked');
    expect(toStatusTone('PENDING')).toBe('pending');
    expect(toStatusTone('WARN')).toBe('review');
    expect(toStatusTone('NOT_VERIFIED')).toBe('review');
  });

  it('accepts case and separator variants of the same status', () => {
    expect(toStatusTone('  not-verified ')).toBe('review');
    expect(toStatusTone('in progress')).toBe('pending');
    expect(normalizeStatus(' approval required ')).toBe('APPROVAL_REQUIRED');
  });

  it('maps build lifecycle statuses onto the same tones', () => {
    expect(toStatusTone('DEPLOYED')).toBe('pass');
    expect(toStatusTone('BUILDING')).toBe('pending');
    expect(toStatusTone('DRAFT')).toBe('neutral');
  });

  it('never shows an unknown or empty status as a pass (fail closed)', () => {
    for (const raw of ['COMPLETE', 'OK', 'GREEN', 'SUCCESS', 'PASSING', '', '   ', null, undefined]) {
      expect(toStatusTone(raw)).toBe('neutral');
    }
  });

  it('has a Thai gloss for every tone except neutral', () => {
    expect(STATUS_TONE_GLOSS.pass).toBe('ผ่าน');
    expect(STATUS_TONE_GLOSS.fail).toBe('ไม่ผ่าน');
    expect(STATUS_TONE_GLOSS.blocked).toBe('ถูกบล็อก');
    expect(STATUS_TONE_GLOSS.pending).toBe('รอดำเนินการ');
    expect(STATUS_TONE_GLOSS.review).toBe('ต้องตรวจสอบ');
    expect(STATUS_TONE_GLOSS.neutral).toBe('');
  });
});
