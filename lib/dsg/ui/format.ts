export type RelativeParts = { value: number; unit: Intl.RelativeTimeFormatUnit };

// Pure so it can be tested with a fixed clock. Returns null for an unparseable date so the UI
// shows nothing rather than "NaN".
export function relativeParts(iso: string, now: number): RelativeParts | null {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return null;
  const seconds = Math.trunc((then - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return { value: seconds, unit: 'second' };
  const minutes = Math.trunc(seconds / 60);
  if (Math.abs(minutes) < 60) return { value: minutes, unit: 'minute' };
  const hours = Math.trunc(minutes / 60);
  if (Math.abs(hours) < 24) return { value: hours, unit: 'hour' };
  const days = Math.trunc(hours / 24);
  if (Math.abs(days) < 30) return { value: days, unit: 'day' };
  const months = Math.trunc(days / 30);
  if (Math.abs(months) < 12) return { value: months, unit: 'month' };
  return { value: Math.trunc(days / 365), unit: 'year' };
}

export function formatRelativeTime(iso: string, now: number = Date.now(), locale = 'th'): string {
  const parts = relativeParts(iso, now);
  if (!parts) return '';
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(parts.value, parts.unit);
}
