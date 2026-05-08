export type OpenAIAdapterStatus = {
  configured: boolean;
  status: 'configured' | 'missing_env';
  baseUrl: string;
  model: string;
  requiredEnv: string[];
  optionalEnv: string[];
  truthBoundary: string;
};

export type OpenAIChatMessage = {
  role: 'system' | 'developer' | 'user' | 'assistant';
  content: string;
};

export type OpenAIAdapterInput = {
  input?: string;
  messages?: OpenAIChatMessage[];
  model?: string;
  maxOutputTokens?: number;
  temperature?: number;
};

export type OpenAIAdapterOutput = {
  provider: 'openai';
  model: string;
  outputText: string;
  responseId?: string;
  usage?: unknown;
};

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4.1-mini';

export function getOpenAIAdapterStatus(): OpenAIAdapterStatus {
  const configured = Boolean(process.env.OPENAI_API_KEY?.trim());
  return {
    configured,
    status: configured ? 'configured' : 'missing_env',
    baseUrl: process.env.OPENAI_API_BASE?.trim() || DEFAULT_BASE_URL,
    model: process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL,
    requiredEnv: ['OPENAI_API_KEY'],
    optionalEnv: ['OPENAI_API_BASE', 'OPENAI_MODEL'],
    truthBoundary: configured
      ? 'OpenAI-compatible adapter is configured server-side. The API key must never be exposed to client code.'
      : 'OPENAI_API_KEY is missing from the server environment. Adapter calls are blocked until the key exists in Vercel or the runtime environment.',
  };
}

function normalizeMessages(input: OpenAIAdapterInput): OpenAIChatMessage[] {
  if (input.messages?.length) return input.messages.filter((message) => message.content.trim());
  const text = input.input?.trim();
  if (!text) throw new Error('OPENAI_INPUT_REQUIRED');
  return [{ role: 'user', content: text }];
}

function toChatMessages(messages: OpenAIChatMessage[]) {
  return messages.map((message) => ({
    role: message.role === 'developer' ? 'system' : message.role,
    content: message.content,
  }));
}

function errorMessage(payload: Record<string, unknown> | null, status: number, prefix = 'OPENAI_HTTP') {
  const error = payload?.error;
  if (error && typeof error === 'object' && typeof (error as Record<string, unknown>).message === 'string') {
    return (error as Record<string, string>).message;
  }
  return `${prefix}_${status}`;
}

function extractResponsesText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const record = payload as Record<string, unknown>;
  if (typeof record.output_text === 'string') return record.output_text;

  const output = record.output;
  if (!Array.isArray(output)) return '';

  const parts: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const contentItem of content) {
      if (!contentItem || typeof contentItem !== 'object') continue;
      const text = (contentItem as Record<string, unknown>).text;
      if (typeof text === 'string') parts.push(text);
    }
  }
  return parts.join('\n').trim();
}

function extractChatText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const choices = (payload as Record<string, unknown>).choices;
  if (!Array.isArray(choices)) return '';
  const parts: string[] = [];
  for (const choice of choices) {
    if (!choice || typeof choice !== 'object') continue;
    const message = (choice as Record<string, unknown>).message;
    if (!message || typeof message !== 'object') continue;
    const content = (message as Record<string, unknown>).content;
    if (typeof content === 'string') parts.push(content);
  }
  return parts.join('\n').trim();
}

async function runResponsesApi(args: {
  baseUrl: string;
  model: string;
  messages: OpenAIChatMessage[];
  maxOutputTokens: number;
  temperature: number;
}) {
  const response = await fetch(`${args.baseUrl}/responses`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: args.model,
      input: args.messages.map((message) => ({ role: message.role, content: message.content })),
      max_output_tokens: args.maxOutputTokens,
      temperature: args.temperature,
    }),
  });

  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) throw new Error(errorMessage(payload, response.status));

  return {
    outputText: extractResponsesText(payload),
    responseId: typeof payload?.id === 'string' ? payload.id : undefined,
    usage: payload?.usage,
  };
}

async function runChatCompletionsApi(args: {
  baseUrl: string;
  model: string;
  messages: OpenAIChatMessage[];
  maxOutputTokens: number;
  temperature: number;
}) {
  const response = await fetch(`${args.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: args.model,
      messages: toChatMessages(args.messages),
      max_tokens: args.maxOutputTokens,
      temperature: args.temperature,
      stream: false,
    }),
  });

  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) throw new Error(errorMessage(payload, response.status, 'CHAT_COMPLETIONS_HTTP'));

  return {
    outputText: extractChatText(payload),
    responseId: typeof payload?.id === 'string' ? payload.id : undefined,
    usage: payload?.usage,
  };
}

function shouldUseChatCompletionsFirst(baseUrl: string) {
  const value = `${baseUrl} ${process.env.OPENAI_COMPAT_MODE || ''}`.toLowerCase();
  return value.includes('localhost') || value.includes('127.0.0.1') || value.includes('ollama') || value.includes('lmstudio') || value.includes('chat');
}

export async function runOpenAIAdapter(input: OpenAIAdapterInput): Promise<OpenAIAdapterOutput> {
  const status = getOpenAIAdapterStatus();
  if (!status.configured) throw new Error('OPENAI_API_KEY_MISSING');

  const messages = normalizeMessages(input);
  const model = input.model?.trim() || status.model;
  const maxOutputTokens = Math.min(Math.max(input.maxOutputTokens ?? 800, 1), 4096);
  const temperature = typeof input.temperature === 'number' ? input.temperature : 0.2;
  const baseUrl = status.baseUrl.replace(/\/$/, '');
  const args = { baseUrl, model, messages, maxOutputTokens, temperature };

  try {
    const result = shouldUseChatCompletionsFirst(baseUrl)
      ? await runChatCompletionsApi(args)
      : await runResponsesApi(args);
    return { provider: 'openai', model, ...result };
  } catch (primaryError) {
    try {
      const result = shouldUseChatCompletionsFirst(baseUrl)
        ? await runResponsesApi(args)
        : await runChatCompletionsApi(args);
      return { provider: 'openai', model, ...result };
    } catch {
      throw primaryError;
    }
  }
}
