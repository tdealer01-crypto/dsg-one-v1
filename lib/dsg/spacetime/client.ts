export type SpacetimeToolName =
  | 'spacetime_discover'
  | 'spacetime_compose'
  | 'spacetime_execute'
  | 'spacetime_request_approval'
  | 'spacetime_resolve_approval'
  | 'spacetime_verify_evidence';

export type SpacetimeToolResult = Record<string, unknown> & {
  verdict?: string;
  reason?: string;
  decision?: { verdict?: string; reason?: string; decision_hash?: string };
};

type McpEnvelope = {
  result?: {
    structuredContent?: SpacetimeToolResult;
    content?: Array<{ type?: string; text?: string }>;
    isError?: boolean;
  };
  error?: { code?: number; message?: string };
};

function config() {
  const url = process.env.DSG_SPACETIME_MCP_URL?.trim();
  const token = process.env.DSG_SPACETIME_INTERNAL_API_KEY?.trim();
  if (!url) throw new Error('SPACETIME_MCP_URL_REQUIRED');
  if (!/^http:\/\/spacetime:8787\/mcp$/.test(url) && process.env.NODE_ENV === 'production') {
    throw new Error('SPACETIME_MCP_URL_NOT_INTERNAL');
  }
  if (!token || token.length < 32) throw new Error('SPACETIME_INTERNAL_AUTH_REQUIRED');
  return { url, token };
}

export function spacetimeClientConfigured(): boolean {
  try {
    config();
    return true;
  } catch {
    return false;
  }
}

export async function callSpacetimeTool(
  name: SpacetimeToolName,
  args: Record<string, unknown>,
): Promise<SpacetimeToolResult> {
  const { url, token } = config();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: `core-spin-${Date.now()}`,
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  });

  const envelope = await response.json().catch(() => null) as McpEnvelope | null;
  if (!response.ok) throw new Error(`SPACETIME_HTTP_${response.status}`);
  if (!envelope || envelope.error) {
    throw new Error(`SPACETIME_RPC_ERROR:${envelope?.error?.message ?? 'INVALID_RESPONSE'}`);
  }
  const structured = envelope.result?.structuredContent;
  if (!structured || typeof structured !== 'object') {
    throw new Error('SPACETIME_STRUCTURED_CONTENT_REQUIRED');
  }
  return structured;
}
