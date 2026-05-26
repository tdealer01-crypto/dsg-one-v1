const DSG_BASE = process.env.DSG_APP_URL || "https://dsg-one-v1.vercel.app";
export async function callDsgGate(skill, evidence) {
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
        if (!res.ok)
            return { verdict: "BLOCK", auditId: "gate-error" };
        const data = (await res.json());
        return {
            verdict: data.finalVerdict ?? "BLOCK",
            auditId: data.auditId ?? "unknown",
        };
    }
    catch {
        return { verdict: "BLOCK", auditId: "gate-fetch-error" };
    }
}
export async function dsgRequest(endpoint, options) {
    const res = await fetch(`${DSG_BASE}${endpoint}`, {
        ...options,
        headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    });
    if (!res.ok)
        throw new Error(`DSG API error: ${res.status} ${res.statusText}`);
    return res.json();
}
