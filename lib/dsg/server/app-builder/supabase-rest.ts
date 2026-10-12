type SupabaseRequest = {
  method?: 'GET' | 'POST' | 'PATCH';
  path: string;
  query?: string;
  body?: unknown;
};

// This is a server-only client. The repo-scoped values must reference the
// same Supabase project used for verified DSG actor/workspace membership.
// Never fall back to a public/anon key or another project's generic env.
function getSupabaseRestConfig() {
  const url = process.env.DSG_ONE_V1_SUPABASE_URL?.trim();
  const key = process.env.DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url) throw new Error('APP_BUILDER_DB_URL_NOT_CONFIGURED');
  if (!key) throw new Error('APP_BUILDER_DB_SERVICE_ROLE_NOT_CONFIGURED');
  if (key.startsWith('sb_publishable_')) throw new Error('APP_BUILDER_DB_SERVICE_ROLE_INVALID');

  return { url: url.replace(/\/+$/, ''), key };
}

export async function supabaseRest<T>(input: SupabaseRequest): Promise<T> {
  const { url, key } = getSupabaseRestConfig();
  const target = `${url}/rest/v1/${input.path}${input.query ?? ''}`;

  // Modern sb_secret_* keys are not JWTs. Legacy service_role JWT keys
  // still support the Bearer header. Both use the server-only apikey.
  const headers: Record<string, string> = {
    apikey: key,
    'content-type': 'application/json',
    prefer: 'return=representation',
  };
  if (!key.startsWith('sb_secret_')) headers.authorization = `Bearer ${key}`;

  let response: Response;
  try {
    response = await fetch(target, {
      method: input.method ?? 'GET',
      headers,
      cache: 'no-store',
      body: input.body === undefined ? undefined : JSON.stringify(input.body),
    });
  } catch {
    throw new Error('APP_BUILDER_DB_CONNECT_FAILED');
  }

  // Do not propagate raw PostgREST error messages: they can contain schema
  // details, SQL, or private operational information.
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('APP_BUILDER_DB_ACCESS_DENIED');
    }
    if (response.status === 404) {
      throw new Error('APP_BUILDER_DB_SCHEMA_OR_ROUTE_NOT_FOUND');
    }
    if (response.status >= 500) {
      throw new Error('APP_BUILDER_DB_UPSTREAM_UNAVAILABLE');
    }
    throw new Error('APP_BUILDER_DB_REQUEST_REJECTED');
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new Error('APP_BUILDER_DB_RESPONSE_INVALID');
  }
}
