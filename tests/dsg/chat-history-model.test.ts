import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { listAgentConversation } from '@/lib/dsg/agent-runtime/chat-history';
import { runDsgChatModel, getDsgChatModelConfig } from '@/lib/dsg/agent-runtime/chat-model';
import { supabaseRest } from '@/lib/dsg/server/app-builder/supabase-rest';

vi.mock('@/lib/dsg/server/app-builder/supabase-rest', () => ({
  supabaseRest: vi.fn(),
}));

const rest = vi.mocked(supabaseRest);
const verified = { actorId: 'owner-actor', workspaceId: 'owner-workspace', actorRole: 'OWNER' };
const messages = [{ role: 'developer' as const, content: 'Answer in Thai.' }, { role: 'user' as const, content: 'สวัสดี' }];
const env = { ...process.env };

describe('DSG chat durable history isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads ONLY the verified actor and workspace and restores role order', async () => {
    rest.mockResolvedValueOnce([
      { id: 'm2', actor_id: 'owner-actor', workspace_id: 'owner-workspace', raw_text: '[assistant] สวัสดีครับ',
        metadata: { source: 'live-agent-chat', role: 'assistant' }, created_at: '2026-10-19T10:00:01Z', status: 'active' },
      { id: 'm1', actor_id: 'owner-actor', workspace_id: 'owner-workspace', raw_text: '[user] สวัสดี',
        metadata: { source: 'live-agent-chat', role: 'user' }, created_at: '2026-10-19T10:00:00Z', status: 'active' },
      { id: 'leak', actor_id: 'another-actor', workspace_id: 'owner-workspace', raw_text: '[user] secret',
        metadata: { source: 'live-agent-chat', role: 'user' }, created_at: '2026-10-19T09:00:00Z', status: 'active' },
    ] as never);
    const result = await listAgentConversation(verified);
    const arg = rest.mock.calls[0][0];
    expect(arg.query).toContain('workspace_id=eq.owner-workspace');
    expect(arg.query).toContain('actor_id=eq.owner-actor');
    expect(arg.query).toContain('source_type=eq.conversation');
    expect(result).toEqual([
      { id: 'm1', role: 'user', text: 'สวัสดี', createdAt: '2026-10-19T10:00:00Z' },
      { id: 'm2', role: 'assistant', text: 'สวัสดีครับ', createdAt: '2026-10-19T10:00:01Z' },
    ]);
  });

  it('never queries the database without a verified owner', async () => {
    await expect(listAgentConversation({ ...verified, actorId: '' })).rejects.toThrow('DSG_AUTH_REQUIRED');
    expect(rest).not.toHaveBeenCalled();
  });

  it('drops unrelated workspace memory and ignores non-conversation entries', async () => {
    rest.mockResolvedValueOnce([
      { id: 'note', actor_id: verified.actorId, workspace_id: verified.workspaceId, raw_text: '[user] note',
        metadata: { source: 'manual-note', role: 'user' }, created_at: '2026-10-19T09:00:00Z' },
    ] as never);
    expect(await listAgentConversation(verified)).toEqual([]);
  });
});

describe('DSG AI model answers are not fabricated local model output', () => {
  beforeEach(() => {
    process.env = { ...env };
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    vi.unstubAllGlobals();
  });
  afterEach(() => { process.env = { ...env }; vi.unstubAllGlobals(); });

  it('does not mislabel DSG v0 plan route as an active chat model', () => {
    expect(getDsgChatModelConfig().dsgV0ChatBound).toBe(false);
  });

  it('reports missing credentials instead of producing fake AI text', async () => {
    await expect(runDsgChatModel(messages)).rejects.toThrow('DSG_CHAT_NO_MODEL_CREDENTIALS');
  });

  it('uses a real configured Gemini endpoint if OpenAI is not configured', async () => {
    process.env.GEMINI_API_KEY = 'test-only-redacted-secret';
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'คำตอบจาก Gemini' }] } }],
      usageMetadata: { totalTokenCount: 20 },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    const result = await runDsgChatModel(messages);
    expect(result).toMatchObject({ provider: 'gemini', outputText: 'คำตอบจาก Gemini' });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\//);
    expect(url).not.toContain('test-only-redacted-secret');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('test-only-redacted-secret');
  });

  it('rejects Gemini non-200 without exposing the provider response or key', async () => {
    process.env.GEMINI_API_KEY = 'never-expose-this';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('invalid credential', { status: 401 })));
    await expect(runDsgChatModel(messages)).rejects.toThrow('GEMINI_CHAT_HTTP_401');
  });
});
