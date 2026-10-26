import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireVerifiedDsgActor } from '@/lib/dsg/server/context';
import { listAgentConversation } from '@/lib/dsg/agent-runtime/chat-history';
import { persistAgentChatTurn } from '@/lib/dsg/agent-runtime/persistent-chat-memory';
import { GET, POST } from '@/app/api/dsg/agent-v0/conversation/route';

vi.mock('@/lib/dsg/server/context', () => ({ requireVerifiedDsgActor: vi.fn() }));
vi.mock('@/lib/dsg/agent-runtime/chat-history', () => ({ listAgentConversation: vi.fn() }));
vi.mock('@/lib/dsg/agent-runtime/persistent-chat-memory', () => ({ persistAgentChatTurn: vi.fn() }));
const actor = vi.mocked(requireVerifiedDsgActor);
const read = vi.mocked(listAgentConversation);
const write = vi.mocked(persistAgentChatTurn);
const request = (body: object, origin = 'https://dsg.pics') => new Request('https://dsg.pics/api/dsg/agent-v0/conversation', {
  method: 'POST', headers: { origin, 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

describe('DSG Agent v0 existing authenticated durable conversation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    actor.mockResolvedValue({ actorId: 'actor-1', workspaceId: 'workspace-1', role: 'OWNER' });
    read.mockResolvedValue([{ id: 'm1', role: 'user', text: 'hello', createdAt: '2026-10-26T00:00:00Z' }]);
    write.mockResolvedValue({ saved: ['m1'], errors: [] });
  });

  it('loads only authenticated actor-scoped existing conversation', async () => {
    const res = await GET(new Request('https://dsg.pics/api/dsg/agent-v0/conversation'));
    expect(res.status).toBe(200);
    expect(read).toHaveBeenCalledWith({ actorId: 'actor-1', workspaceId: 'workspace-1', actorRole: 'OWNER' });
    expect((await res.json()).data.messages).toHaveLength(1);
  });

  it('stores one turn with verified identity without invoking a second chat model', async () => {
    const res = await POST(request({ role: 'user', text: 'Inspect status' }));
    expect(res.status).toBe(201);
    expect(write).toHaveBeenCalledWith(expect.anything(), {
      userMessage: 'Inspect status', agentReply: '',
    }, { actorId: 'actor-1', workspaceId: 'workspace-1', actorRole: 'OWNER' });
  });

  it('blocks foreign origins, forged metadata and pasted secrets', async () => {
    expect((await POST(request({ role: 'user', text: 'hello' }, 'https://foreign.test'))).status).toBe(403);
    expect((await POST(request({ role: 'user', text: 'hello', workspaceId: 'other' }))).status).toBe(400);
    expect((await POST(request({ role: 'user', text: 'github_pat_example' }))).status).toBe(400);
    expect(write).not.toHaveBeenCalled();
  });

  it('never reports persistence success on a failed database write', async () => {
    write.mockResolvedValueOnce({ saved: [], errors: ['MEMORY_PERSIST_FAILED'] });
    const res = await POST(request({ role: 'assistant', text: 'Step completed' }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('AGENT_V0_MEMORY_PERSIST_UNVERIFIED');
  });
});
