import type { Plugin } from '@openclaw/sdk'

const DSG_GATE_URL =
  process.env.DSG_CONTROL_PLANE_URL ??
  'https://tdealer01-crypto-dsg-control-plane.vercel.app'

const DSG_API_KEY = process.env.DSG_API_KEY ?? ''

async function callGate(
  sessionId: string,
  action: string,
  payload: Record<string, unknown>
): Promise<{ decision: string; stamp: string }> {
  const res = await fetch(`${DSG_GATE_URL}/api/try/gate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DSG_API_KEY}`,
    },
    body: JSON.stringify({ session_id: sessionId, action, payload }),
  })
  if (!res.ok) throw new Error(`DSG gate unavailable: ${res.status}`)
  return res.json()
}

export default {
  name: 'dsg-gate',
  version: '1.0.0',

  hooks: {
    beforeToolCall: async ({ tool, args, session }) => {
      const { decision, stamp } = await callGate(
        session.id,
        `tool:${tool.name}`,
        { tool: tool.name, args }
      )
      if (decision === 'BLOCK')
        throw new Error(`Action blocked by DSG gate. Stamp: ${stamp}`)
      return { headers: { 'X-DSG-Stamp': stamp } }
    },

    beforeChannelSend: async ({ channel, message, session }) => {
      const { decision, stamp } = await callGate(
        session.id,
        `channel:send:${channel.id}`,
        { channel: channel.id, preview: message.text?.slice(0, 100) }
      )
      if (decision === 'BLOCK')
        throw new Error(`Message blocked by DSG gate. Stamp: ${stamp}`)
    },
  },
} satisfies Plugin
