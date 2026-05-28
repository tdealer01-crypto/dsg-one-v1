import { NextRequest, NextResponse } from 'next/server'
import { runWithGate } from '@/lib/ai-runner'

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN ?? ''
const WA_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN ?? ''
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID ?? ''

async function sendMessage(to: string, text: string) {
  await fetch(`https://graph.facebook.com/v21.0/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${WA_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      text: { body: text },
    }),
  })
}

// Webhook verification (Meta requires GET)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  if (
    searchParams.get('hub.mode') === 'subscribe' &&
    searchParams.get('hub.verify_token') === VERIFY_TOKEN
  ) {
    return new NextResponse(searchParams.get('hub.challenge'))
  }
  return new NextResponse('Forbidden', { status: 403 })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const entry = body?.entry?.[0]?.changes?.[0]?.value
  const msg = entry?.messages?.[0]

  if (msg?.type !== 'text') return NextResponse.json({ ok: true })

  const from: string = msg.from
  const text: string = msg.text.body
  const sessionId = `whatsapp_${from}`

  const { reply } = await runWithGate(sessionId, text).catch(() => ({
    reply: '⚠️ Error processing request.',
    decision: 'ERROR',
    stamp: '',
  }))

  await sendMessage(from, reply)
  return NextResponse.json({ ok: true })
}
