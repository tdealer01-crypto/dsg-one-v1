import { NextResponse } from 'next/server';
import type { OpenAIChatMessage } from '@/lib/dsg/ai/openai-adapter';
import { getDsgChatModelConfig, runDsgChatModel } from '@/lib/dsg/agent-runtime/chat-model';
import { listAgentConversation } from '@/lib/dsg/agent-runtime/chat-history';
import { routeAgentCommand } from '@/lib/dsg/agent-runtime/command-router';
import { DSG_STUDIO_REFERENCE_PROMPT, buildPlanPaneInstruction } from '@/lib/dsg/agent-runtime/studio-reference';
import { DSG_GRAPHIFY_CONTEXT_PROMPT, buildGraphifyInstruction, shouldUseGraphifyContext } from '@/lib/dsg/agent-runtime/graphify-reference';
import { DSG_PHASE1_GOVERNANCE_PROMPT, buildPhase1GovernanceInstruction, shouldUsePhase1Governance } from '@/lib/dsg/agent-runtime/phase1-governance-reference';
import { DSG_GOVERNANCE_DB_PROMPT, buildGovernanceDbInstruction, shouldUseGovernanceDb } from '@/lib/dsg/agent-runtime/governance-db-reference';
import { loadExternalAgentContext, type ExternalContextResult } from '@/lib/dsg/agent-runtime/external-context-tools';
import { buildPersistentMemoryPrompt, loadPersistentAgentMemory, persistAgentChatTurn, type AgentChatHistoryItem, type AgentPersistentMemoryResult, type AgentChatVerifiedIdentity } from '@/lib/dsg/agent-runtime/persistent-chat-memory';
import { requireVerifiedDsgActor } from '@/lib/dsg/server/context';

export const runtime = 'nodejs';

type ChatBody = {
  message?: string;
  history?: AgentChatHistoryItem[];
  context?: {
    stage?: string;
    idea?: string;
    features?: string[];
    notes?: string[];
    surface?: string;
  };
};

function shouldPlan(message: string) {
  return /plan|วางแผน|แผน|workflow|flow|ขั้นตอน|execute|browser|approval|อนุมัติ|proof|evidence|หลักฐาน|สร้าง|build|app/i.test(message);
}

function normalizedHistory(history: unknown): AgentChatHistoryItem[] {
  if (!Array.isArray(history)) return [];
  return history
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const role = record.role === 'assistant' ? 'assistant' : record.role === 'user' ? 'user' : null;
      const content = typeof record.content === 'string' ? record.content.trim() : '';
      return role && content ? { role, content: content.slice(0, 3000) } : null;
    })
    .filter((item): item is AgentChatHistoryItem => Boolean(item))
    .slice(-18);
}

function buildMessages(body: ChatBody, memory: AgentPersistentMemoryResult, externalContext: ExternalContextResult): OpenAIChatMessage[] {
  const message = body.message?.trim();
  if (!message) throw new Error('AGENT_CHAT_MESSAGE_REQUIRED');
  const useGraphify = shouldUseGraphifyContext(message);
  const usePhase1Governance = shouldUsePhase1Governance(message);
  const useGovernanceDb = shouldUseGovernanceDb(message);
  const history = normalizedHistory(body.history);

  const developerPrompt = [
    'You are DSG ONE V1 Agent, an enterprise governed app-builder assistant.',
    'Answer the user directly and specifically. Do not repeat a fixed script.',
    'Use concise Thai unless the user asks for English.',
    'Use the recent chat history and persistent memory to avoid asking the user to repeat what they already said.',
    'When the user says “above”, “ที่คุยไป”, “ทั้งหมดที่บอก”, or similar, summarize the relevant requirement from history and memory first, then answer.',
    'When external API context is present, use it as fresh tool evidence. Do not invent results. If an external API is unavailable or failed, say exactly that.',
    'When the user wants to build, plan, operate, verify, inspect a repo, connect tools, read governance memory/state, or work with a codebase, use the DSG planning, execution, Graphify, Phase 1 governance, and governance database rules below.',
    'Respect the DSG truth boundary: do not claim deploy, production verification, audit proof, PR evidence, browser proof, repo implementation, connector execution, database row existence, external API result, or build status unless the UI/API/tool/database has produced evidence.',
    'Persistent memory is context, not proof. If memory conflicts with current user input or evidence, prefer current user input and verified evidence.',
    'Prefer actionable next steps the user can click or verify in the app.',
    '',
    DSG_STUDIO_REFERENCE_PROMPT,
    '',
    buildPersistentMemoryPrompt(memory),
    '',
    externalContext.promptText,
    '',
    useGraphify ? DSG_GRAPHIFY_CONTEXT_PROMPT : 'Graphify context is available but not required for this ordinary question.',
    '',
    usePhase1Governance ? DSG_PHASE1_GOVERNANCE_PROMPT : 'Phase 1 connector/governance reference is available but not required for this ordinary question.',
    '',
    useGovernanceDb ? DSG_GOVERNANCE_DB_PROMPT : 'Governance DB schema reference is available but not required for this ordinary question.',
    '',
    useGraphify ? buildGraphifyInstruction(message) : '',
    usePhase1Governance ? buildPhase1GovernanceInstruction(message) : '',
    useGovernanceDb ? buildGovernanceDbInstruction(message) : '',
    shouldPlan(message) ? buildPlanPaneInstruction(message) : 'For ordinary questions, answer briefly and only add a plan pane if it is useful.',
  ].filter(Boolean).join('\n');

  return [
    { role: 'developer', content: developerPrompt },
    ...history.map((item): OpenAIChatMessage => ({ role: item.role, content: item.content })),
    {
      role: 'user',
      content: JSON.stringify({
        userMessage: message,
        appBuilderContext: body.context ?? {},
        persistentMemoryStatus: memory.status,
        externalToolStatus: externalContext.items.map((item) => ({ tool: item.tool, status: item.status, reason: item.reason, sourceUrl: item.sourceUrl })),
      }),
    },
  ];
}

function localFallbackReply(message: string, providerError: string, memory: AgentPersistentMemoryResult, externalContext: ExternalContextResult) {
  // Deterministic routing remains available for diagnostics but is NOT a chat model.
  const route = routeAgentCommand({
    command: message,
    context: `AI_MODEL_UNAVAILABLE; memory=${memory.status}; external=${externalContext.items.map(item => item.tool + ':' + item.status).join(',')}`,
    userBenefit: 'ผู้ใช้เห็นสถานะจริงและสามารถเริ่มงานใหม่ได้เมื่อเชื่อมโมเดลสำเร็จ',
  });

  // Never inject lengthy plans, raw provider diagnostics, search configuration or
  // developer-only policy text into a user-facing chat response as fake AI output.
  const missingCredential = providerError === 'DSG_CHAT_NO_MODEL_CREDENTIALS';
  const reply = [
    missingCredential
      ? 'ยังไม่ได้เชื่อมโมเดล AI สำหรับแชท DSG ONE บนเซิร์ฟเวอร์'
      : 'โมเดล AI ยังไม่ตอบกลับในขณะนี้',
    'ข้อความนี้เป็นสถานะระบบ ไม่ใช่คำตอบจากโมเดล และยังไม่ได้สั่งให้ Agent ลงมือทำ',
    missingCredential
      ? 'ผู้ดูแลต้องตั้งค่า OpenAI หรือ Gemini ฝั่งเซิร์ฟเวอร์เพื่อเปิดแชทจริง'
      : 'ตรวจการเชื่อมต่อโมเดลแล้วลองอีกครั้ง โดยไม่ต้องส่งคำสั่ง Execute ซ้ำ',
    'ถ้าต้องการใช้ DSG Agent v0 (Qwen) ให้เลือกแท็บ Agent v0 เมื่อ Brain Worker พร้อมใช้งาน',
  ].join('\n');
  return { reply, route };
}

function authFailure(error: unknown) {
  const code = error instanceof Error ? error.message : 'DSG_AUTH_FAILED';
  const status = code === 'DSG_AUTH_REQUIRED' ? 401 : code === 'DSG_CONTEXT_REQUIRED' || code === 'DSG_PERMISSION_DENIED' ? 403 : 500;
  return NextResponse.json({ ok: false, error: { code, message: code } }, { status });
}

export async function GET(req: Request) {
  let identity: AgentChatVerifiedIdentity;
  try {
    const actor = await requireVerifiedDsgActor(req.headers, 'job:read');
    identity = { workspaceId: actor.workspaceId, actorId: actor.actorId, actorRole: actor.role };
  } catch (error) {
    return authFailure(error);
  }
  try {
    const messages = await listAgentConversation(identity);
    return NextResponse.json({ ok: true, data: { messages, source: 'dsg_memory_events', modelConnection: getDsgChatModelConfig() } }, {
      headers: { 'cache-control': 'no-store' },
    });
  } catch {
    return NextResponse.json({
      ok: false,
      error: { code: 'DSG_CHAT_HISTORY_UNAVAILABLE', message: 'ยังโหลดประวัติจากฐานข้อมูลไม่ได้' },
    }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}

export async function POST(req: Request) {
  let verifiedIdentity: AgentChatVerifiedIdentity;
  try {
    const actor = await requireVerifiedDsgActor(req.headers, 'job:read');
    verifiedIdentity = {
      workspaceId: actor.workspaceId,
      actorId: actor.actorId,
      actorRole: actor.role,
    };
  } catch (error) {
    return authFailure(error);
  }

  const body = (await req.json().catch(() => null)) as ChatBody | null;
  if (!body?.message?.trim()) {
    return NextResponse.json({ ok: false, error: { message: 'AGENT_CHAT_MESSAGE_REQUIRED' } }, { status: 400 });
  }

  const history = normalizedHistory(body.history);
  // Reuse the existing memory ingestion path and save the user's message
  // BEFORE slow model/context calls. A refresh while the reply is pending
  // must not silently erase the submitted turn.
  const userPersisted = await persistAgentChatTurn(req, {
    userMessage: body.message,
    agentReply: '',
    history,
  }, verifiedIdentity).catch(() => ({
    saved: [] as string[],
    errors: ['MEMORY_USER_TURN_PERSIST_FAILED'],
  }));
  const memory = await loadPersistentAgentMemory(req, body.message, verifiedIdentity);
  const externalContext = await loadExternalAgentContext(body.message);

  try {
    const result = await runDsgChatModel(buildMessages({ ...body, history }, memory, externalContext));
    const reply = result.outputText || 'ผมยังตอบไม่ได้จากโมเดลในรอบนี้ ลองพิมพ์รายละเอียดเพิ่มอีกครั้งครับ';
    const persisted = await persistAgentChatTurn(req, { userMessage: '', agentReply: reply, history }, verifiedIdentity).catch((error) => ({
      saved: [],
      errors: [error instanceof Error ? error.message : 'MEMORY_PERSIST_FAILED'],
    }));

    return NextResponse.json({
      ok: true,
      data: {
        reply,
        model: result.model,
        provider: result.provider,
        modelStatus: 'ready',
        responseId: result.responseId,
        usage: result.usage,
        fallback: false,
        memory: {
          status: memory.status,
          enabled: memory.enabled,
          memoryIds: memory.memoryIds,
          gateStatus: memory.gateStatus,
          savedIds: [...userPersisted.saved, ...persisted.saved],
          persistErrors: [...userPersisted.errors, ...persisted.errors],
        },
        externalTools: externalContext.items.map((item) => ({
          tool: item.tool,
          status: item.status,
          sourceUrl: item.sourceUrl,
          reason: item.reason,
          evidence: item.evidence,
        })),
      },
    });
  } catch (error) {
    const providerError = error instanceof Error ? error.message : 'AGENT_CHAT_MODEL_UNAVAILABLE';
    const fallback = localFallbackReply(body.message, providerError, memory, externalContext);
    const persisted = await persistAgentChatTurn(req, { userMessage: '', agentReply: fallback.reply, history }, verifiedIdentity).catch((persistError) => ({
      saved: [],
      errors: [persistError instanceof Error ? persistError.message : 'MEMORY_PERSIST_FAILED'],
    }));
    return NextResponse.json({
      ok: true,
      data: {
        reply: fallback.reply,
        model: 'dsg-local-fallback',
        provider: 'none',
        modelStatus: 'unavailable',
        providerError,
        fallback: true,
        route: fallback.route,
        memory: {
          status: memory.status,
          enabled: memory.enabled,
          memoryIds: memory.memoryIds,
          gateStatus: memory.gateStatus,
          savedIds: [...userPersisted.saved, ...persisted.saved],
          persistErrors: [...userPersisted.errors, ...persisted.errors],
        },
        externalTools: externalContext.items.map((item) => ({
          tool: item.tool,
          status: item.status,
          sourceUrl: item.sourceUrl,
          reason: item.reason,
          evidence: item.evidence,
        })),
      },
    });
  }
}
