export type AgentModelMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type AgentModelResult =
  | { ok: true; provider: string; model: string; content: string }
  | { ok: false; provider: string; model?: string; error: string };

function env(names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value?.trim()) return value.trim();
  }
  return undefined;
}

function messagesToPrompt(messages: AgentModelMessage[]): string {
  return messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
}

export async function callAgentModel(input: {
  messages: AgentModelMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<AgentModelResult> {
  const model = env(['DSG_AGENT_MODEL', 'AI_MODEL', 'OPENAI_MODEL', 'GEMINI_MODEL']);
  if (!model) {
    return { ok: false, provider: 'none', error: 'MODEL_NOT_CONFIGURED' };
  }

  const googleKey = env(['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENAI_API_KEY']);
  if (googleKey) {
    return callGemini({ model, key: googleKey, ...input });
  }

  const openaiKey = env(['OPENAI_API_KEY', 'DSG_AI_API_KEY']);
  if (openaiKey) {
    return callOpenAI({ model, key: openaiKey, ...input });
  }

  return { ok: false, provider: 'none', model, error: 'MODEL_KEY_NOT_CONFIGURED' };
}

async function callGemini(input: {
  model: string;
  key: string;
  messages: AgentModelMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<AgentModelResult> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent?key=${encodeURIComponent(input.key)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: messagesToPrompt(input.messages) }] }],
        generationConfig: {
          temperature: input.temperature ?? 0.1,
          maxOutputTokens: input.maxTokens ?? 1200,
        },
      }),
    },
  );
  const json = await res.json().catch(() => null) as any;
  if (!res.ok) return { ok: false, provider: 'google', model: input.model, error: `MODEL_HTTP_${res.status}` };
  const content = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join('\n')?.trim();
  return content
    ? { ok: true, provider: 'google', model: input.model, content }
    : { ok: false, provider: 'google', model: input.model, error: 'MODEL_EMPTY_RESPONSE' };
}

async function callOpenAI(input: {
  model: string;
  key: string;
  messages: AgentModelMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<AgentModelResult> {
  const base = env(['OPENAI_BASE_URL', 'DSG_AI_BASE_URL']) ?? 'https://api.openai.com/v1';
  const res = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${input.key}` },
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      temperature: input.temperature ?? 0.1,
      max_tokens: input.maxTokens ?? 1200,
    }),
  });
  const json = await res.json().catch(() => null) as any;
  if (!res.ok) return { ok: false, provider: 'openai-compatible', model: input.model, error: `MODEL_HTTP_${res.status}` };
  const content = json?.choices?.[0]?.message?.content?.trim();
  return content
    ? { ok: true, provider: 'openai-compatible', model: input.model, content }
    : { ok: false, provider: 'openai-compatible', model: input.model, error: 'MODEL_EMPTY_RESPONSE' };
}
