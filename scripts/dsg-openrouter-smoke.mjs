#!/usr/bin/env node

const endpoint = 'https://openrouter.ai/api/v1/chat/completions';
const apiKey = process.env.OPENROUTER_API_KEY?.trim();
const model = process.env.OPENROUTER_MODEL?.trim() || 'openrouter/free';
const fallbackModels = (process.env.OPENROUTER_FALLBACK_MODELS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const models = [...new Set([model, ...fallbackModels])];

if (!apiKey) {
  console.error('BLOCK: OPENROUTER_API_KEY is required. Add it locally or in Vercel; do not paste it into chat.');
  process.exit(1);
}

const messages = [
  {
    role: 'system',
    content: 'You are DSG App Builder adapter smoke. Return one short sentence only.',
  },
  {
    role: 'user',
    content: 'Say DSG_OPENROUTER_ADAPTER_READY in Thai and English.',
  },
];

const attempts = [];

for (const candidate of models) {
  const started = Date.now();
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        'http-referer': process.env.OPENROUTER_SITE_URL || 'https://dsg-one-v1.vercel.app',
        'x-title': process.env.OPENROUTER_APP_TITLE || 'DSG One App Builder',
      },
      body: JSON.stringify({
        model: candidate,
        messages,
        temperature: 0.2,
        max_tokens: 80,
      }),
    });

    const text = await response.text();
    attempts.push({ model: candidate, status: response.status, ms: Date.now() - started });

    if (!response.ok) continue;

    const json = JSON.parse(text);
    const content = json?.choices?.[0]?.message?.content;
    if (!content) continue;

    console.log('PASS: DSG OpenRouter adapter smoke completed');
    console.log(JSON.stringify({ model: candidate, attempts, content }, null, 2));
    process.exit(0);
  } catch (error) {
    attempts.push({ model: candidate, error: error instanceof Error ? error.message : String(error), ms: Date.now() - started });
  }
}

console.error('BLOCK: all OpenRouter models failed');
console.error(JSON.stringify({ attempts }, null, 2));
process.exit(1);
