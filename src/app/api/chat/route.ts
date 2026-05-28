import { NextRequest, NextResponse } from 'next/server'
import { runWithGate, type Provider, type ChatMessage } from '@/lib/ai-runner'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const maxDuration = 60 // Vercel Pro: 60s timeout for agentic tasks

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)

  if (!body?.session_id || !body?.message) {
    return NextResponse.json(
      { error: 'session_id and message required' },
      { status: 400 }
    )
  }

  const {
    session_id,
    message,
    provider = 'claude',
    history = [],
  }: {
    session_id: string
    message: string
    provider?: Provider
    history?: ChatMessage[]
  } = body

  const { reply, decision, stamp, toolsUsed } = await runWithGate(
    session_id,
    message,
    history,
    provider
  )

  const now = new Date().toISOString()
  await supabase.from('chat_messages').insert([
    {
      session_id,
      role: 'user',
      content: message,
      dsg_decision: decision,
      dsg_stamp: stamp,
      created_at: now,
    },
    ...(decision !== 'BLOCK'
      ? [
          {
            session_id,
            role: 'assistant',
            content: reply,
            dsg_decision: decision,
            dsg_stamp: stamp,
            tools_used: toolsUsed,
            created_at: now,
          },
        ]
      : []),
  ])

  return NextResponse.json({ reply, decision, stamp, tools_used: toolsUsed })
}
