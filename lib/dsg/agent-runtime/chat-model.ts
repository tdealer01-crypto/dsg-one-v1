import { getOpenAIAdapterStatus, runOpenAIAdapter, type OpenAIChatMessage } from '@/lib/dsg/ai/openai-adapter';

export type ChatModelResult = {
  provider: 'openai' | 'gemini';
  model: string;
  outputText: string;
  responseId?: string;
  usage?: unknown;
};

function geminiKey(): string | undefined {
  return process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
}

function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
}

export function getDsgChatModelConfig() {
  return {
    openai: getOpenAIAdapterStatus().configured,
    gemini: Boolean(geminiKey()),
    // DSG v0 on Kaggle currently exposes governed action.plan,
    // NOT an authenticated general-purpose chat-completions API.
    dsgV0ChatBound: false,
  };
}

// Server-side model fallback, not an extra DSG approval gate.
// Each provider is tried only if its own server credential exists.
// No public or user-supplied model URL, no anonymous execute tool.
async function callGemini(messages: OpenAIChatMessage[], maxOutputTokens: number): Promise<ChatModelResult> {
  const key = geminiKey();
  if (!key) throw new Error('GEMINI_CHAT_CREDENTIAL_MISSING');
  const model = geminiModel();
  const systemText = messages.filter(item => item.role === 'system' || item.role === 'developer')
    .map(item => item.content).join('\n\n');
  const contents = messages.filter(item => item.role === 'user' || item.role === 'assistant')
    .map(item => ({ role: item.role === 'assistant' ? 'model' : 'user', parts: [{ text: item.content }] }));
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemText }] },
      contents,
      generationConfig: { maxOutputTokens, temperature: 0.25 },
    }),
  });
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`GEMINI_CHAT_HTTP_${response.status}`);
  }
  const payload = await response.json() as {
    responseId?: string;
    usageMetadata?: unknown;
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const outputText = payload.candidates?.[0]?.content?.parts
    ?.map(part => typeof part.text === 'string' ? part.text : '').join('\n').trim() || '';
  if (!outputText) throw new Error('GEMINI_CHAT_EMPTY_RESPONSE');
  return { provider: 'gemini', model, outputText, responseId: payload.responseId, usage: payload.usageMetadata };
}

export async function runDsgChatModel(messages: OpenAIChatMessage[]): Promise<ChatModelResult> {
  const config = getDsgChatModelConfig();
  let primaryError = 'OPENAI_API_KEY_MISSING';
  if (config.openai) {
    try {
      const result = await runOpenAIAdapter({ messages, maxOutputTokens: 1800, temperature: 0.25 });
      if (!result.outputText.trim()) throw new Error('OPENAI_CHAT_EMPTY_RESPONSE');
      return result;
    } catch (error) {
      primaryError = error instanceof Error ? error.message : 'OPENAI_CHAT_UNAVAILABLE';
    }
  }
  if (config.gemini) {
    try {
      return await callGemini(messages, 1800);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'GEMINI_CHAT_UNAVAILABLE';
      throw new Error(`MODEL_PROVIDERS_UNAVAILABLE:OPENAI=${primaryError};GEMINI=${code}`);
    }
  }
  if (!config.openai) throw new Error('DSG_CHAT_NO_MODEL_CREDENTIALS');
  throw new Error(`OPENAI_CHAT_UNAVAILABLE:${primaryError}`);
}
