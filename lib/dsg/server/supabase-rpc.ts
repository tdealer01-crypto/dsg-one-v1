export type DsgSupabaseRpcConfig = {
  url: string;
  key: string;
  userAccessToken?: string;
};

export type DsgRpcError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

export function getDsgSupabaseRpcConfig(userAccessToken?: string): DsgSupabaseRpcConfig {
  const url = process.env.DSG_ONE_V1_SUPABASE_URL;
  const key = process.env.DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error('DSG_ONE_V1_SUPABASE_URL_REQUIRED');
  if (!key) throw new Error('DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY_REQUIRED');

  return { url: url.replace(/\/$/, ''), key, userAccessToken };
}

function parseJsonBody<T>(text: string): T | DsgRpcError | null {
  return text ? (JSON.parse(text) as T | DsgRpcError) : null;
}

export async function callDsgRpc<T>(
  config: DsgSupabaseRpcConfig,
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${config.url}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.userAccessToken ?? config.key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const payload = parseJsonBody<T>(await response.text());

  if (!response.ok) {
    const error = payload as DsgRpcError | null;
    throw new Error(error?.message ?? `DSG_RPC_${response.status}`);
  }

  return payload as T;
}

export async function readDsgRest<T>(
  config: DsgSupabaseRpcConfig,
  tableName: string,
  searchParams: Record<string, string>,
): Promise<T> {
  const url = new URL(`${config.url}/rest/v1/${tableName}`);
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  const payload = parseJsonBody<T>(await response.text());

  if (!response.ok) {
    const error = payload as DsgRpcError | null;
    throw new Error(error?.message ?? `DSG_REST_${response.status}`);
  }

  return payload as T;
}

export function getBearerToken(headers: Headers): string | undefined {
  const value = headers.get('authorization');
  if (!value?.toLowerCase().startsWith('bearer ')) return undefined;
  return value.slice('bearer '.length).trim();
}
