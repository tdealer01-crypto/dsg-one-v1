import { NextRequest, NextResponse } from 'next/server'
import { runWithGate } from '@/lib/ai-runner'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''

async function sendMessage(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
}

export async function POST(req: NextRequest) {
  const update = await req.json().catch(() => null)
  const msg = update?.message
  if (!msg?.text) return NextResponse.json({ ok: true })

  const chatId: number = msg.chat.id
  const text: string = msg.text
  const sessionId = `telegram_${chatId}`

  const { reply, decision } = await runWithGate(sessionId, text).catch(() => ({
    reply: '⚠️ Error processing request.',
    decision: 'ERROR',
    stamp: '',
  }))

  await sendMessage(chatId, reply)
  return NextResponse.json({ ok: true })
}
