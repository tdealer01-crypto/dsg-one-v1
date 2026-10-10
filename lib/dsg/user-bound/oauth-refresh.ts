/** Stable public codes only. Never display provider error descriptions or tokens. */
const RENEWAL_ERRORS = new Set([
  'missing_refresh_token', 'invalid_grant', 'login_required',
  'consent_required', 'interaction_required', 'invalid_refresh_token',
  'invalid_client', 'missing_transaction',
]);

export type Auth0SessionFailure = 'AUTH0_REFRESH_NOT_AVAILABLE' | 'AUTH0_IDENTITY_UNAVAILABLE';

export function classifyAuth0SessionFailure(error: unknown): Auth0SessionFailure {
  if (error instanceof Error && error.message === 'AUTH0_NO_DELEGATED_TOKEN') return 'AUTH0_REFRESH_NOT_AVAILABLE';
  if (typeof error !== 'object' || error === null) return 'AUTH0_IDENTITY_UNAVAILABLE';
  const raw = (error as { error?: unknown }).error;
  return typeof raw === 'string' && RENEWAL_ERRORS.has(raw)
    ? 'AUTH0_REFRESH_NOT_AVAILABLE'
    : 'AUTH0_IDENTITY_UNAVAILABLE';
}
