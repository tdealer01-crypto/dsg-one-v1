/** Allowlist for Auth0 return routes; no arbitrary URL or foreign origin. */
export function dsgAuth0ReturnTo(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const allowed = new Set([
    '/dsg/workroom',
    '/dsg/workroom?tool=agent-v0',
    '/dsg/workroom?tool=browser',
    '/dsg/workroom?tool=desktop',
  ]);
  return allowed.has(value) ? value : null;
}
