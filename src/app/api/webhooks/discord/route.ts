import { NextRequest, NextResponse } from 'next/server'
import { runWithGate } from '@/lib/ai-runner'
import { createVerify } from 'crypto'

const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY ?? ''

function verifyDiscordSignature(
  rawBody: string,
  signature: string,
  timestamp: string
): boolean {
  try {
    const verifier = createVerify('ed25519')
    verifier.update(Buffer.from(timestamp + rawBody))
    return verifier.verify(
      Buffer.from(PUBLIC_KEY, 'hex'),
      Buffer.from(signature, 'hex')
    )
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

  const body = JSON.parse(rawBody)

  // Discord PING handshake
  if (body.type === 1) return NextResponse.json({ type: 1 })

  // Application command
  if (body.type === 2) {
    const text: string =
      body.data?.options?.[0]?.value ?? body.data?.name ?? ''
    const userId: string = body.member?.user?.id ?? body.user?.id ?? 'unknown'
    const sessionId = `discord_${userId}`

    const { reply, decision } = await runWithGate(sessionId, text).catch(
      () => ({ reply: '⚠️ Error.', decision: 'ERROR', stamp: '' })
    )

    return NextResponse.json({
      type: 4,
      data: { content: reply },
    })
  }

  return NextResponse.json({ ok: true })
}
