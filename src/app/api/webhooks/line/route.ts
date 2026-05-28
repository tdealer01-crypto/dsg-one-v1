import { NextRequest, NextResponse } from 'next/server'
import { runWithGate } from '@/lib/ai-runner'
import { createHmac } from 'crypto'

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET ?? ''
const CHANNEL_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? ''

function verifyLineSignature(body: string, sig: string): boolean {
  const digest = createHmac('sha256', CHANNEL_SECRET)
    .update(body)
    .digest('base64')
  return digest === sig
}

async function replyMessage(replyToken: string, text: string) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CHANNEL_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }],
    }),
  })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const sig = req.headers.get('x-line-signature') ?? ''

  if (!verifyLineSignature(rawBody, sig)) {
    return new NextResponse('Invalid signature', { status: 401 })
  }

  const body = JSON.parse(rawBody)

  for (const event of body.events ?? []) {
    if (event.type !== 'message' || event.message.type !== 'text') continue

    const userId: string = event.source.userId
    const text: string = event.message.text
    const replyToken: string = event.replyToken
    const sessionId = `line_${userId}`

    const { reply } = await runWithGate(sessionId, text).catch(() => ({
      reply: '⚠️ Error processing request.',
      decision: 'ERROR',
      stamp: '',
    }))

    await replyMessage(replyToken, reply)
  }

  return NextResponse.json({ ok: true })
}
