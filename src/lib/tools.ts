import type { Tool } from '@anthropic-ai/sdk'
import { Sandbox } from 'e2b'

export const TOOL_DEFINITIONS: Tool[] = [
  {
    name: 'web_search',
    description: 'Search the web for current information, news, prices, documentation.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        max_results: { type: 'number', description: 'Max results (default 5)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'browser_action',
    description: 'Open a URL and read its full content as markdown text.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to open and read' },
      },
      required: ['url'],
    },
  },
  {
    name: 'run_code',
    description: 'Execute Python or JavaScript code in an isolated cloud sandbox. Returns stdout/stderr.',
    input_schema: {
      type: 'object',
      properties: {
        language: { type: 'string', enum: ['python', 'javascript'] },
        code: { type: 'string', description: 'Code to execute' },
      },
      required: ['language', 'code'],
    },
  },
  {
    name: 'shell_command',
    description: 'Run a bash/shell command in a cloud sandbox: git, curl, ls, npm, pip, etc.',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to run' },
      },
      required: ['command'],
    },
  },
  {
    name: 'mcp_call',
    description: 'Call a tool on an MCP (Model Context Protocol) server via HTTP.',
    input_schema: {
      type: 'object',
      properties: {
        server_url: { type: 'string', description: 'MCP server HTTP URL' },
        tool_name: { type: 'string', description: 'Tool name to call' },
        arguments: { type: 'object', description: 'Tool arguments' },
      },
      required: ['server_url', 'tool_name'],
    },
  },
]

// --- Tool executors ---

export async function execWebSearch(query: string, maxResults = 5): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) return '[web_search] TAVILY_API_KEY not set'
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, query, max_results: maxResults }),
  })
  if (!res.ok) return `[web_search] HTTP ${res.status}`
  const data = await res.json() as { results?: Array<{ title: string; url: string; content: string }> }
  return JSON.stringify(
    (data.results ?? []).map((r) => ({ title: r.title, url: r.url, snippet: r.content?.slice(0, 400) })),
    null, 2
  )
}

export async function execBrowserAction(url: string): Promise<string> {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) return '[browser] FIRECRAWL_API_KEY not set'
  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ url, formats: ['markdown'] }),
  })
  if (!res.ok) return `[browser] HTTP ${res.status}`
  const data = await res.json() as { data?: { markdown?: string }; markdown?: string }
  return (data.data?.markdown ?? data.markdown ?? '').slice(0, 3000)
}

async function e2bRun(command: string): Promise<string> {
  const apiKey = process.env.E2B_API_KEY
  if (!apiKey) return '[e2b] E2B_API_KEY not set'

  const sandbox = await Sandbox.create({
    apiKey,
    timeoutMs: 50_000,
  })

  try {
    const result = await sandbox.commands.run(command, { timeoutMs: 45_000 })
    const out = [
      (result.stdout ?? '').slice(0, 2000),
      result.stderr ? `\n[stderr] ${result.stderr.slice(0, 500)}` : '',
    ].join('').trim()
    return out || '(no output)'
  } finally {
    await sandbox.kill().catch(() => {})
  }
}

export function execRunCode(language: string, code: string): Promise<string> {
  const cmd = language === 'python'
    ? `python3 -c ${JSON.stringify(code)}`
    : `node -e ${JSON.stringify(code)}`
  return e2bRun(cmd)
}

export function execShellCommand(command: string): Promise<string> {
  return e2bRun(command)
}

export async function execMcpCall(
  serverUrl: string,
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<string> {
  const res = await fetch(serverUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name: toolName, arguments: args } }),
  })
  if (!res.ok) return `[mcp] HTTP ${res.status}`
  const data = await res.json() as { result?: unknown; error?: unknown }
  return JSON.stringify(data.result ?? data.error, null, 2).slice(0, 3000)
}

export async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'web_search':
      return execWebSearch(input.query as string, (input.max_results as number) ?? 5)
    case 'browser_action':
      return execBrowserAction(input.url as string)
    case 'run_code':
      return execRunCode(input.language as string, input.code as string)
    case 'shell_command':
      return execShellCommand(input.command as string)
    case 'mcp_call':
      return execMcpCall(input.server_url as string, input.tool_name as string, (input.arguments as Record<string, unknown>) ?? {})
    default:
      return `[tools] unknown tool: ${name}`
  }
}
