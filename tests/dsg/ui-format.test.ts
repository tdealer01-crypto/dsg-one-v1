import {describe, expect, it} from 'vitest';
import {formatRelativeTime, relativeParts} from '@/lib/dsg/ui/format';

const NOW = Date.parse('2026-10-12T12:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const S = 1000;
const MIN = 60 * S;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('relative time', () => {
  it('picks the largest sensible unit', () => {
    expect(relativeParts(ago(30 * S), NOW)).toEqual({ value: -30, unit: 'second' });
    expect(relativeParts(ago(5 * MIN), NOW)).toEqual({ value: -5, unit: 'minute' });
    expect(relativeParts(ago(2 * HOUR), NOW)).toEqual({ value: -2, unit: 'hour' });
    expect(relativeParts(ago(3 * DAY), NOW)).toEqual({ value: -3, unit: 'day' });
    expect(relativeParts(ago(65 * DAY), NOW)).toEqual({ value: -2, unit: 'month' });
    expect(relativeParts(ago(800 * DAY), NOW)).toEqual({ value: -2, unit: 'year' });
  });

  it('returns nothing for an unparseable date instead of showing NaN', () => {
    expect(relativeParts('not a date', NOW)).toBeNull();
    expect(formatRelativeTime('', NOW)).toBe('');
  });

  it('formats through Intl in Thai without throwing', () => {
    const text = formatRelativeTime(ago(2 * HOUR), NOW);
    expect(text).toBe(new Intl.RelativeTimeFormat('th', { numeric: 'auto' }).format(-2, 'hour'));
    expect(text.length).toBeGreaterThan(0);
  });
});
