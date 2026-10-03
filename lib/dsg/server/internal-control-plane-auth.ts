import { timingSafeEqual } from 'node:crypto';

function normalized(value: string | undefined): string | undefined {
  const candidate = value?.trim();
  return candidate ? candidate : undefined;
}

export function isDsgInternalControlPlaneAuthorized(
  provided: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const expected = normalized(env.DSG_SPACETIME_INTERNAL_API_KEY);
  const actual = normalized(provided);
  if (!expected || expected.length < 32 || !actual) return false;

  const expectedBytes = Buffer.from(expected, 'utf8');
  const actualBytes = Buffer.from(actual, 'utf8');
  if (expectedBytes.length !== actualBytes.length) return false;
  return timingSafeEqual(expectedBytes, actualBytes);
}
