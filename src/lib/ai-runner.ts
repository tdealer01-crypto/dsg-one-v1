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
  return res.json()
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
    return {
      reply: `❌ Action blocked by DSG governance. [${stamp}]`,
      decision,
      stamp,
      toolsUsed: [],
    }
  }

  // Non-Claude providers: simple single-turn (no tool use)
  if (provider === 'gemini') {
    const reply = await callGemini(message, history)
    return { reply, decision, stamp, toolsUsed: [] }
  }

  // Claude: full agentic loop with tool use
  const reply = await agenticLoop(sessionId, message, history, stamp)
  return { reply: reply.text, decision, stamp, toolsUsed: reply.toolsUsed }
}

// --- Agentic loop (Claude tool use) ---

interface LoopResult {
  text: string
  toolsUsed: string[]
}

async function agenticLoop(
  sessionId: string,
  message: string,
  history: ChatMessage[],
  dsgStamp: string
): Promise<LoopResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const toolsUsed: string[] = []

  type AnthropicMsg = Anthropic.MessageParam
  const messages: AnthropicMsg[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ]

  // Max 10 tool-call rounds to prevent runaway loops
  for (let round = 0; round < 10; round++) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      tools: TOOL_DEFINITIONS as Anthropic.Tool[],
      messages,
      system: [
        'You are a powerful AI agent with access to web search, browser control,',
        'code execution, shell commands, and MCP tools.',
        'Use tools proactively to complete tasks. Be concise in final answers.',
        `DSG governance stamp: ${dsgStamp}`,
      ].join(' '),
    })

    // Done — return final text
    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find((b) => b.type === 'text')
      return {
        text: textBlock?.type === 'text' ? textBlock.text : '(no response)',
        toolsUsed,
      }
    }

    // Tool use round
    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content })

      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue

        toolsUsed.push(block.name)

        // Gate each tool call individually
        const gateRes = await gate(sessionId, `tool:${block.name}`).catch(
          () => ({ decision: 'ALLOW', stamp: dsgStamp })
        )

        let toolOutput: string
        if (gateRes.decision === 'BLOCK') {
          toolOutput = `❌ Tool '${block.name}' blocked by DSG gate.`
        } else {
          toolOutput = await executeTool(
            block.name,
            block.input as Record<string, unknown>
          ).catch((e: Error) => `[tool error] ${e.message}`)
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: toolOutput,
        })
      }

      messages.push({ role: 'user', content: toolResults })
      continue
    }

    // Unexpected stop reason
    break
  }

  return { text: '(agent loop ended without response)', toolsUsed }
}

// --- Gemini (simple, no tool use) ---

async function callGemini(
  message: string,
  _history: ChatMessage[]
): Promise<string> {
  const { GoogleGenAI } = await import('@google/genai')
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! })
  const res = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: message,
  })
  return res.text ?? ''
}
