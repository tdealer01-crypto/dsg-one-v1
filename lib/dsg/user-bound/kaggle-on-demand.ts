/** Fail closed: only an absent/unreachable Brain binding may trigger owner wake. */
const WAKE_CODES = new Set(['DSG_BRAIN_BASE_URL_INVALID', 'DSG_BRAIN_UPSTREAM_UNAVAILABLE']);

export function shouldRequestKaggleWake(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = error.message.trim().split(':').at(-1)?.trim();
  return Boolean(code && WAKE_CODES.has(code));
}
