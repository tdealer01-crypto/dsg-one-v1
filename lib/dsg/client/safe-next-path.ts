const FALLBACK = '/dsg/access';
const INTERNAL_ORIGIN = 'https://dsg.invalid';

/**
 * Return only a browser-safe, same-origin relative URL after sign-in.
 * This is navigation hygiene, not authentication or authorization.
 */
export function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return FALLBACK;
  // WHATWG URL treats backslashes like slashes for special schemes. In
  // particular, /\\evil.example can become //evil.example on navigation.
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return FALLBACK;
  try {
    const destination = new URL(value, INTERNAL_ORIGIN);
    if (destination.origin !== INTERNAL_ORIGIN || !destination.pathname.startsWith('/')) return FALLBACK;
    return destination.pathname + destination.search + destination.hash;
  } catch {
    return FALLBACK;
  }
}
