import type { Config } from '@openclaw/sdk'

export default {
  server: {
    port: 3000,
    host: 'localhost',
  },

  // DSG gate extension loads first — gates every action before execution
  extensions: [
    './extensions/dsg-gate',
    '@openclaw/ext-whatsapp',
    '@openclaw/ext-telegram',
    '@openclaw/ext-discord',
    '@openclaw/ext-line',
    '@openclaw/ext-signal',
    '@openclaw/ext-matrix',
    '@openclaw/ext-slack',
    '@openclaw/ext-mattermost',
    '@openclaw/ext-teams',
    '@openclaw/ext-irc',
    '@openclaw/ext-google-chat',
    '@openclaw/ext-feishu',
    '@openclaw/ext-zalo',
    '@openclaw/ext-qq',
    '@openclaw/ext-nextcloud-talk',
    '@openclaw/ext-imessage',
    '@openclaw/ext-voice',
    '@openclaw/ext-elevenlabs',
  ],

  providers: [
    {
      id: 'claude',
      type: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-sonnet-4-6',
    },
    {
      id: 'gemini',
      type: 'google',
      apiKey: process.env.GOOGLE_API_KEY,
      model: 'gemini-2.0-flash',
    },
    {
      id: 'openai',
      type: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o',
    },
  ],

  defaultProvider: 'claude',

  memory: {
    type: 'lancedb',
    path: '~/.openclaw/memory',
  },

  security: {
    untrustedInboundDMs: true,
    requirePairingCode: true,
  },
} satisfies Config
