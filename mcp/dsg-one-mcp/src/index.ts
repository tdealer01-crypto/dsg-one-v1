#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express, { type Request, type Response } from "express";
import { dsgTools } from "./tools.js";

const server = new McpServer({
  name: "dsg-one-mcp",
  version: "1.0.0",
});

for (const tool of dsgTools) {
  server.tool(tool.name, tool.description, tool.schema.shape, tool.handler);
}

async function startHttpServer(): Promise<void> {
  const app = express();
  app.use(express.json());

  let sseTransport: SSEServerTransport | null = null;

  app.get("/sse", (_req: Request, res: Response) => {
    sseTransport = new SSEServerTransport("/messages", res);
    server.connect(sseTransport).catch(console.error);
  });

  app.post("/messages", (req: Request, res: Response) => {
    if (!sseTransport) {
      res.status(400).json({ error: "No active SSE connection" });
      return;
    }
    sseTransport.handlePostMessage(req, res);
  });

  const port = Number(process.env.MCP_PORT ?? 3001);
  await new Promise<void>((resolve) => app.listen(port, resolve));
  console.error(`DSG ONE MCP Server (HTTP/SSE) running on http://localhost:${port}`);
  console.error("  SSE:      GET  /sse");
  console.error("  Messages: POST /messages");
}

async function main(): Promise<void> {
  if (process.argv.includes("--http")) {
    await startHttpServer();
    return;
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("DSG ONE MCP Server running (stdio)");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
