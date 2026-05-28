export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { runWithGate } from '@/lib/ai-runner'
import { createVerify } from 'crypto'

const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY ?? ''

function verifyDiscordSignature(rawBody: string, signature: string, timestamp: string): boolean {
  try {
    const verifier = createVerify('ed25519')
    verifier.update(Buffer.from(timestamp + rawBody))
    return verifier.verify(Buffer.from(PUBLIC_KEY, 'hex'), Buffer.from(signature, 'hex'))
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const sig = req.headers.get('x-signature-ed25519') ?? ''
  const timestamp = req.headers.get('x-signature-timestamp') ?? ''

  if (!verifyDiscordSignature(rawBody, sig, timestamp)) {
    return new NextResponse('Invalid signature', { status: 401 })
  }

  const body = JSON.parse(rawBody) as { type: number; data?: { options?: Array<{ value: string }>; name?: string }; member?: { user?: { id: string } }; user?: { id: string } }

  if (body.type === 1) return NextResponse.json({ type: 1 })

  if (body.type === 2) {
    const text = body.data?.options?.[0]?.value ?? body.data?.name ?? ''
    const userId = body.member?.user?.id ?? body.user?.id ?? 'unknown'
    const { reply } = await runWithGate(`discord_${userId}`, text).catch(
      () => ({ reply: '⚠️ Error.', decision: 'ERROR', stamp: '', toolsUsed: [] })
    )
    return NextResponse.json({ type: 4, data: { content: reply } })
  }

  return NextResponse.json({ ok: true })
}
