// Bound, non-sensitive public error codes for persisted App Builder jobs.
// Raw Supabase/SQL/provider errors must never be forwarded to the browser.
export function classifyAppBuilderJobError(error: unknown): { code: string; status: number } {
  const code = error instanceof Error ? error.message : '';

  if (code === 'DSG_AUTH_REQUIRED' || code === 'DSG_CONTEXT_REQUIRED') {
    return { code, status: 401 };
  }
  if (code === 'DSG_PERMISSION_DENIED') {
    return { code, status: 403 };
  }
  if (code === 'APP_BUILDER_GOAL_REQUIRED') {
    return { code, status: 400 };
  }
  if (code === 'APP_BUILDER_JOB_NOT_FOUND') {
    return { code, status: 404 };
  }

  const databaseCodes = [
    'APP_BUILDER_DB_URL_NOT_CONFIGURED',
    'APP_BUILDER_DB_SERVICE_ROLE_NOT_CONFIGURED',
    'APP_BUILDER_DB_SERVICE_ROLE_INVALID',
    'APP_BUILDER_DB_CONNECT_FAILED',
    'APP_BUILDER_DB_ACCESS_DENIED',
    'APP_BUILDER_DB_SCHEMA_OR_ROUTE_NOT_FOUND',
    'APP_BUILDER_DB_UPSTREAM_UNAVAILABLE',
    'APP_BUILDER_DB_REQUEST_REJECTED',
    'APP_BUILDER_DB_RESPONSE_INVALID',
  ];
  if (databaseCodes.includes(code)) return { code, status: 503 };

  return { code: 'APP_BUILDER_REQUEST_FAILED', status: 500 };
}
