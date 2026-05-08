import { NextResponse } from 'next/server';
import { runOpenAIAdapter, type OpenAIChatMessage } from '@/lib/dsg/ai/openai-adapter';
import { routeAgentCommand } from '@/lib/dsg/agent-runtime/command-router';

export const runtime = 'nodejs';

type ChatBody = {
  message?: string;
  context?: {
    stage?: string;
    idea?: string;
    features?: string[];
    notes?: string[];
    surface?: string;
  };
};

function buildMessages(body: ChatBody): OpenAIChatMessage[] {
  const message = body.message?.trim();
  if (!message) throw new Error('AGENT_CHAT_MESSAGE_REQUIRED');

  return [
    {
      role: 'developer',
      content: [
        'You are DSG ONE V1 Agent, an enterprise governed app-builder assistant.',
        'Answer the user directly and specifically. Do not repeat a fixed script.',
        'Use concise Thai unless the user asks for English.',
        'When the user wants to build something, ask at most one useful follow-up or propose concrete features.',
        'Respect the DSG truth boundary: do not claim deploy, production verification, audit proof, or PR evidence unless the UI/API has produced it.',
        'Prefer actionable next steps the user can click or verify in the app.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: JSON.stringify({
        userMessage: message,
        appBuilderContext: body.context ?? {},
      }),
    },
  ];
}

function localFallbackReply(message: string, providerError: string) {
  const route = routeAgentCommand({
    command: message,
    context: 'Fallback from DSG Agent Chat because the AI provider is unavailable.',
    userBenefit: 'ผู้ใช้ยังได้คำตอบและขั้นตอนต่อไป แม้ AI provider จะใช้งานไม่ได้ชั่วคราว',
  });

  const evidence = route.evidence.length ? route.evidence.join(', ') : 'route decision';
  const reply = [
    `ตอนนี้ AI model ใช้งานไม่ได้ชั่วคราว: ${providerError}`,
    '',
    'ผมใช้ DSG local fallback วิเคราะห์คำสั่งแทนแล้ว',
    `สถานะ: ${route.status}`,
    `ประเภทงาน: ${route.intent}`,
    `action ที่แนะนำ: ${route.actionLabel}`,
    route.endpoint ? `endpoint: ${route.method || 'GET'} ${route.endpoint}` : undefined,
    `หลักฐานที่ควรได้: ${evidence}`,
    '',
    route.status === 'blocked'
      ? 'คำสั่งนี้ถูกบล็อกตาม policy ต้องปรับคำขอให้ปลอดภัยก่อน'
      : 'ถ้าต้องการสร้างจริง ให้ใช้ Agent Command Center ด้านล่าง แล้วกด Build Now / Run Builder Request เพื่อเข้า governed builder flow',
    '',
    `Truth boundary: ${route.truthBoundary}`,
  ].filter(Boolean).join('\n');

  return { reply, route };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as ChatBody | null;
  if (!body?.message?.trim()) {
    return NextResponse.json({ ok: false, error: { message: 'AGENT_CHAT_MESSAGE_REQUIRED' } }, { status: 400 });
  }

  try {
    const result = await runOpenAIAdapter({
      messages: buildMessages(body),
      maxOutputTokens: 700,
      temperature: 0.25,
    });

    return NextResponse.json({
      ok: true,
      data: {
        reply: result.outputText || 'ผมยังตอบไม่ได้จากโมเดลในรอบนี้ ลองพิมพ์รายละเอียดเพิ่มอีกครั้งครับ',
        model: result.model,
        responseId: result.responseId,
        usage: result.usage,
        fallback: false,
      },
    });
  } catch (error) {
    const providerError = error instanceof Error ? error.message : 'AGENT_CHAT_MODEL_UNAVAILABLE';
    const fallback = localFallbackReply(body.message, providerError);
    return NextResponse.json({
      ok: true,
      data: {
        reply: fallback.reply,
        model: 'dsg-local-fallback',
        providerError,
        fallback: true,
        route: fallback.route,
      },
    });
  }
}
