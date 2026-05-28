import Anthropic from '@anthropic-ai/sdk'

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

async function callClaude(
  message: string,
  history: ChatMessage[]
): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const msgs = [
    ...history.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: message },
  ]
  const res = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: msgs,
  })
  const block = res.content[0]
  return block.type === 'text' ? block.text : ''
}

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

export type Provider = 'claude' | 'gemini'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface RunResult {
  reply: string
  decision: string
  stamp: string
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
    }
  }

  const reply =
    provider === 'gemini'
      ? await callGemini(message, history)
      : await callClaude(message, history)

  return { reply, decision, stamp }
}
