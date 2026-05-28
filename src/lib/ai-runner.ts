import Anthropic from '@anthropic-ai/sdk'
import { TOOL_DEFINITIONS, executeTool } from './tools'

const DSG_URL =
  process.env.DSG_CONTROL_PLANE_URL ??
  'https://tdealer01-crypto-dsg-control-plane.vercel.app'

async function gate(
  sessionId: string,
  action: string
): Promise<{ decision: string; stamp: string }> {
  const res = await fetch(`${DSG_URL}/api/try/gate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DSG_API_KEY ?? ''}`,
    },
    body: JSON.stringify({ session_id: sessionId, action }),
  })
  if (!res.ok) throw new Error(`DSG gate error: ${res.status}`)
  return res.json() as Promise<{ decision: string; stamp: string }>
}

export type Provider = 'claude' | 'gemini'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface RunResult {
  reply: string
  decision: string
  stamp: string
  toolsUsed: string[]
}

export async function runWithGate(
  sessionId: string,
  message: string,
  history: ChatMessage[] = [],
  provider: Provider = 'claude'
): Promise<RunResult> {
  const { decision, stamp } = await gate(sessionId, `chat:${provider}`)

  if (decision === 'BLOCK') {
    return { reply: `❌ Action blocked by DSG governance. [${stamp}]`, decision, stamp, toolsUsed: [] }
  }

  if (provider === 'gemini') {
    const reply = await callGemini(message)
    return { reply, decision, stamp, toolsUsed: [] }
  }

  const { text, toolsUsed } = await agenticLoop(sessionId, message, history, stamp)
  return { reply: text, decision, stamp, toolsUsed }
}

async function agenticLoop(
  sessionId: string,
  message: string,
  history: ChatMessage[],
  dsgStamp: string
): Promise<{ text: string; toolsUsed: string[] }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const toolsUsed: string[] = []

  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content } as Anthropic.MessageParam)),
    { role: 'user', content: message },
  ]

  for (let round = 0; round < 10; round++) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      tools: TOOL_DEFINITIONS,
      messages,
      system: `You are a powerful AI agent with tools: web search, browser, code execution, shell commands, and MCP. Use them proactively to complete tasks. DSG stamp: ${dsgStamp}`,
    })

    if (response.stop_reason === 'end_turn') {
      const block = response.content.find((b) => b.type === 'text')
      return { text: block?.type === 'text' ? block.text : '(no response)', toolsUsed }
    }

    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content })

      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue
        toolsUsed.push(block.name)

        const gateRes = await gate(sessionId, `tool:${block.name}`).catch(
          () => ({ decision: 'ALLOW', stamp: dsgStamp })
        )

        const toolOutput = gateRes.decision === 'BLOCK'
          ? `❌ Tool '${block.name}' blocked by DSG gate.`
          : await executeTool(block.name, block.input as Record<string, unknown>)
              .catch((e: Error) => `[tool error] ${e.message}`)

        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: toolOutput })
      }

      messages.push({ role: 'user', content: toolResults })
      continue
    }

    break
  }

  return { text: '(agent loop completed)', toolsUsed }
}

async function callGemini(message: string): Promise<string> {
  const { GoogleGenAI } = await import('@google/genai')
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! })
  const res = await ai.models.generateContent({ model: 'gemini-2.0-flash', contents: message })
  return res.text ?? ''
}
