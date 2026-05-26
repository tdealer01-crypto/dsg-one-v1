const DSG_BASE = process.env.DSG_APP_URL || "https://dsg-one-v1.vercel.app";

export async function callDsgGate(
  skill: string,
  evidence: Record<string, unknown>,
): Promise<{ verdict: "ALLOW" | "REVIEW" | "BLOCK"; auditId: string }> {
  try {
    const res = await fetch(`${DSG_BASE}/api/dsg/marketplace/audit-packet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
  const res = await fetch(`${DSG_BASE}${endpoint}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`DSG API error: ${res.status} ${res.statusText}`);
  return res.json();
}
