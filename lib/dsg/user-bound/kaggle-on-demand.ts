/** Fail closed: only an absent/unreachable Brain binding may trigger owner wake. */
const WAKE_CODES = new Set(['DSG_BRAIN_BASE_URL_INVALID', 'DSG_BRAIN_UPSTREAM_UNAVAILABLE']);

export function shouldRequestKaggleWake(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  // A nested denial such as AUTH_DENIED:DSG_BRAIN_BASE_URL_INVALID must NOT
  // trigger a GPU launch. Only the known execution wrapper is accepted.
  const raw = error.message.trim();
  const code = raw.startsWith('EXECUTION_FAILED:') ? raw.slice('EXECUTION_FAILED:'.length) : raw;
  return WAKE_CODES.has(code);
}
