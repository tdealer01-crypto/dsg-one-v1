// Tool definitions (Claude function calling schema)
export const TOOL_DEFINITIONS = [
  {
    name: 'web_search',
    description:
      'Search the web for current information, news, prices, documentation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query' },
        max_results: { type: 'number', description: 'Max results (default 5)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'browser_action',
    description:
      'Control a real web browser: navigate to URLs, read page content, fill forms.',
    input_schema: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          enum: ['navigate', 'scrape', 'screenshot'],
          description: 'Action to perform',
        },
        url: { type: 'string', description: 'URL to navigate/scrape' },
      },
      required: ['action', 'url'],
    },
  },
  {
    name: 'run_code',
    description:
      'Execute Python or JavaScript code in an isolated cloud sandbox. Returns stdout/stderr.',
    input_schema: {
      type: 'object' as const,
      properties: {
        language: { type: 'string', enum: ['python', 'javascript'] },
        code: { type: 'string', description: 'Code to execute' },
      },
      required: ['language', 'code'],
    },
  },
  {
    name: 'shell_command',
    description:
      'Run a bash/shell command in a cloud sandbox: git, curl, ls, npm, pip, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        command: { type: 'string', description: 'Shell command to run' },
      },
      required: ['command'],
    },
  },
  {
    name: 'mcp_call',
    description:
      'Call a tool on an MCP (Model Context Protocol) server.',
    input_schema: {
      type: 'object' as const,
      properties: {
        server_url: { type: 'string', description: 'MCP server HTTP URL' },
        tool_name: { type: 'string', description: 'Tool name to call' },
        arguments: { type: 'object', description: 'Tool arguments' },
      },
      required: ['server_url', 'tool_name'],
    },
  },
] as const

// --- Tool executors ---

export async function execWebSearch(
  query: string,
  maxResults = 5
): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) return '[web_search] TAVILY_API_KEY not set'

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, query, max_results: maxResults }),
  })
  if (!res.ok) return `[web_search] HTTP ${res.status}`

  const data = await res.json()
  const results = (data.results ?? []).map((r: Record<string, string>) => ({
    title: r.title,
    url: r.url,
    snippet: r.content?.slice(0, 400),
  }))
  return JSON.stringify(results, null, 2)
}

export async function execBrowserAction(
  action: string,
  url: string
): Promise<string> {
  // Firecrawl — works on Vercel serverless, no CDP needed
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) return '[browser] FIRECRAWL_API_KEY not set'

  if (action === 'screenshot') {
    return `[browser] screenshot not supported in serverless mode — use scrape instead`
  }

  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ url, formats: ['markdown'] }),
  })
  if (!res.ok) return `[browser] HTTP ${res.status}`

  const data = await res.json()
  const md: string = data.data?.markdown ?? data.markdown ?? ''
  return md.slice(0, 3000)
}

async function e2bRunCommand(
  command: string,
  language?: string
): Promise<string> {
  const apiKey = process.env.E2B_API_KEY
  if (!apiKey) return '[e2b] E2B_API_KEY not set'

  // Create sandbox
  const createRes = await fetch('https://api.e2b.dev/sandboxes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({ templateID: 'base' }),
  })
  if (!createRes.ok) return `[e2b] create sandbox failed: ${createRes.status}`
  const sandbox = await createRes.json()
  const sandboxId: string = sandbox.sandboxID

  try {
    const runRes = await fetch(
      `https://api.e2b.dev/sandboxes/${sandboxId}/commands`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({ cmd: command, timeout: 20 }),
      }
    )
    if (!runRes.ok) return `[e2b] run failed: ${runRes.status}`
    const runData = await runRes.json()
    const cmdId: string = runData.commandID

    // Wait for result (poll)
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1000))
      const waitRes = await fetch(
        `https://api.e2b.dev/sandboxes/${sandboxId}/commands/${cmdId}`,
        { headers: { 'X-API-Key': apiKey } }
      )
      const waitData = await waitRes.json()
      if (waitData.status === 'finished') {
        return [
          waitData.stdout?.slice(0, 2000) ?? '',
          waitData.stderr ? `\n[stderr] ${waitData.stderr.slice(0, 500)}` : '',
        ]
          .join('')
          .trim()
      }
    }
    return '[e2b] timeout'
  } finally {
    // Clean up sandbox
    await fetch(`https://api.e2b.dev/sandboxes/${sandboxId}`, {
      method: 'DELETE',
      headers: { 'X-API-Key': apiKey },
    }).catch(() => {})
  }
}

export async function execRunCode(
  language: string,
  code: string
): Promise<string> {
  const cmd =
    language === 'python'
      ? `python3 -c ${JSON.stringify(code)}`
      : `node -e ${JSON.stringify(code)}`
  return e2bRunCommand(cmd, language)
}

export async function execShellCommand(command: string): Promise<string> {
  return e2bRunCommand(command)
}

export async function execMcpCall(
  serverUrl: string,
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<string> {
  // MCP Streamable HTTP transport (2025 spec)
  const res = await fetch(serverUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    }),
  })
  if (!res.ok) return `[mcp] HTTP ${res.status}`
  const data = await res.json()
  const content = data.result?.content ?? data.result ?? data.error
  return JSON.stringify(content, null, 2).slice(0, 3000)
}

// Dispatch tool call by name
export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case 'web_search':
      return execWebSearch(
        input.query as string,
        (input.max_results as number) ?? 5
      )
    case 'browser_action':
      return execBrowserAction(
        input.action as string,
        input.url as string
      )
    case 'run_code':
      return execRunCode(input.language as string, input.code as string)
    case 'shell_command':
      return execShellCommand(input.command as string)
    case 'mcp_call':
      return execMcpCall(
        input.server_url as string,
        input.tool_name as string,
        (input.arguments as Record<string, unknown>) ?? {}
      )
    default:
      return `[tools] unknown tool: ${name}`
  }
}
