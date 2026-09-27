const DSG_API_KEY = process.env.DSG_API_KEY;

function dsgBase(): string {
  const raw = (process.env.DSG_APP_URL || "").trim();
  if (!raw) {
    throw new Error(
      "DSG_APP_URL_REQUIRED: set DSG_APP_URL to the currently verified DSG ONE HTTPS runtime from AWS cutover evidence.",
    );
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("DSG_APP_URL_INVALID: DSG_APP_URL must be a valid absolute URL.");
  }
  if (url.protocol !== "https:") {
    throw new Error("DSG_APP_URL_HTTPS_REQUIRED: DSG_APP_URL must use HTTPS.");
  }
  return url.origin.replace(/\/+$/, "");
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (DSG_API_KEY) headers["X-DSG-Api-Key"] = DSG_API_KEY;
  return headers;
}

export async function callDsgGate(
  skill: string,
  evidence: Record<string, unknown>,
): Promise<{ verdict: "ALLOW" | "REVIEW" | "BLOCK"; auditId: string }> {
  try {
    const res = await fetch(`${dsgBase()}/api/dsg/marketplace/audit-packet`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        plugin: "mcp-bridge",
        skill,
        evidence,
        requestedAt: new Date().toISOString(),
      }),
    });
    if (!res.ok) return { verdict: "BLOCK", auditId: "gate-error" };
    const data = (await res.json()) as { finalVerdict?: string; auditId?: string };
    return {
      verdict: (data.finalVerdict as "ALLOW" | "REVIEW" | "BLOCK") ?? "BLOCK",
      auditId: data.auditId ?? "unknown",
    };
  } catch {
    return { verdict: "BLOCK", auditId: "gate-fetch-error" };
  }
}

export async function dsgRequest(endpoint: string, options?: RequestInit): Promise<unknown> {
  const res = await fetch(`${dsgBase()}${endpoint}`, {
    ...options,
    headers: { ...authHeaders(), ...(options?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`DSG API error: ${res.status} ${res.statusText}`);
  return res.json();
}
