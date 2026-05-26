import { z } from "zod";
import { callDsgGate, dsgRequest } from "./dsg-client.js";

type ToolContent = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

function ok(data: unknown): ToolContent {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function blocked(verdict: string, auditId: string): ToolContent {
  return {
    content: [{ type: "text", text: `DSG Gate ${verdict} (auditId: ${auditId})` }],
    isError: true,
  };
}

export const dsgTools = [
  {
    name: "dsg_marketplace_list_templates",
    description: "List available templates from DSG Template Marketplace with search and category filter",
    schema: z.object({
      category: z.string().optional().describe("Filter by category"),
      search: z.string().optional().describe("Search keyword"),
    }),
    handler: async ({ category, search }: { category?: string; search?: string }): Promise<ToolContent> => {
      const gate = await callDsgGate("skill:read", { action: "marketplace_list", noRawCodeExecution: true });
      if (gate.verdict === "BLOCK") return blocked("BLOCK", gate.auditId);
      if (gate.verdict === "REVIEW") return { content: [{ type: "text", text: `REVIEW: marketplace access requires more evidence (auditId: ${gate.auditId})` }] };

      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (search) params.set("search", search);
      const data = await dsgRequest(`/api/dsg/templates?${params.toString()}`);
      return ok(data);
    },
  },

  {
    name: "dsg_marketplace_purchase",
    description: "Purchase a template via Stripe Checkout — returns checkout URL for paid templates",
    schema: z.object({
      templateId: z.string().describe("Template ID to purchase"),
    }),
    handler: async ({ templateId }: { templateId: string }): Promise<ToolContent> => {
      const gate = await callDsgGate("skill:execute", { action: "marketplace_purchase", idempotencyKey: true });
      if (gate.verdict !== "ALLOW") return blocked(gate.verdict, gate.auditId);

      const data = await dsgRequest(`/api/dsg/templates/${templateId}/purchase`, { method: "POST" });
      return ok(data);
    },
  },

  {
    name: "dsg_revenue_summary",
    description: "Get creator revenue summary — cleared, pending, and total payout in THB",
    schema: z.object({}),
    handler: async (): Promise<ToolContent> => {
      const gate = await callDsgGate("skill:read", { action: "revenue_summary", dataScope: "own_tables_only" });
      if (gate.verdict !== "ALLOW") return blocked(gate.verdict, gate.auditId);

      const data = await dsgRequest("/api/dsg/templates/my/payouts");
      return ok(data);
    },
  },

  {
    name: "dsg_graphmap_status",
    description: "Check if the repository knowledge graph is ready or needs building",
    schema: z.object({}),
    handler: async (): Promise<ToolContent> => {
      const gate = await callDsgGate("skill:read", { action: "graphmap_status", noRawCodeExecution: true });
      if (gate.verdict !== "ALLOW") return blocked(gate.verdict, gate.auditId);

      const data = await dsgRequest("/api/plugins/graphmap/status");
      return ok(data);
    },
  },

  {
    name: "dsg_graphmap_build",
    description: "Build (or rebuild) the repository knowledge graph — use only when status is EMPTY or isStale=true",
    schema: z.object({}),
    handler: async (): Promise<ToolContent> => {
      const gate = await callDsgGate("skill:execute", { action: "graphmap_build", noRawCodeExecution: true });
      if (gate.verdict !== "ALLOW") return blocked(gate.verdict, gate.auditId);

      const data = await dsgRequest("/api/plugins/graphmap/build", { method: "POST", body: JSON.stringify({}) });
      return ok(data);
    },
  },

  {
    name: "dsg_graphmap_query",
    description: "Query the repository knowledge graph — returns evidence + ALLOW/REVIEW/BLOCK decision. Check status first; build if EMPTY.",
    schema: z.object({
      question: z.string().describe("Question about repo structure, routes, tables, or dependencies"),
      max_depth: z.number().int().min(1).max(4).optional().describe("BFS depth (default 2)"),
    }),
    handler: async ({ question, max_depth }: { question: string; max_depth?: number }): Promise<ToolContent> => {
      const gate = await callDsgGate("skill:read", { action: "graphmap_query", noRawCodeExecution: true });
      if (gate.verdict !== "ALLOW") return blocked(gate.verdict, gate.auditId);

      const data = await dsgRequest("/api/plugins/graphmap/query", {
        method: "POST",
        body: JSON.stringify({ question, max_depth: max_depth ?? 2 }),
      });
      return ok(data);
    },
  },

  {
    name: "dsg_skillgate_audit",
    description: "Run a DSG SkillGate audit-packet check — returns finalVerdict, gate evidence counts, and missingEvidenceCount",
    schema: z.object({}),
    handler: async (): Promise<ToolContent> => {
      const data = await dsgRequest("/api/dsg/marketplace/audit-packet");
      return ok(data);
    },
  },

  {
    name: "dsg_agent_status",
    description: "Check production DSG ONE V1 health — verifies the deployment is live",
    schema: z.object({}),
    handler: async (): Promise<ToolContent> => {
      const data = await dsgRequest("/api/agent/status");
      return ok(data);
    },
  },
];
