import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/dsg/agent-chat/route';
import { requireVerifiedDsgActor } from '@/lib/dsg/server/context';
import { listAgentConversation } from '@/lib/dsg/agent-runtime/chat-history';

vi.mock('@/lib/dsg/server/context', () => ({
  requireVerifiedDsgActor: vi.fn(),
}));
vi.mock('@/lib/dsg/agent-runtime/chat-history', () => ({
  listAgentConversation: vi.fn(),
}));
const auth = vi.mocked(requireVerifiedDsgActor);
const history = vi.mocked(listAgentConversation);

describe('GET /api/dsg/agent-chat restores existing memory, not a new memory engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.mockResolvedValue({ workspaceId: 'w-123', actorId: 'a-123', role: 'OWNER' } as never);
    history.mockResolvedValue([{ id: 'rec-1', role: 'user', text: 'สวัสดี', createdAt: '2026-10-19T01:00:00Z' }]);
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('uses the verified existing actor/workspace only, and disables response caching', async () => {
    const response = await GET(new Request('https://dsg.pics/api/dsg/agent-chat'));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({
      ok: true, data: { source: 'dsg_memory_events', messages: [{ role: 'user', text: 'สวัสดี' }] },
    });
    expect(auth).toHaveBeenCalledWith(expect.any(Headers), 'job:read');
    expect(history).toHaveBeenCalledWith({ workspaceId: 'w-123', actorId: 'a-123', actorRole: 'OWNER' });
  });

  it('rejects unauthenticated history retrieval rather than returning another user data', async () => {
    auth.mockRejectedValueOnce(new Error('DSG_AUTH_REQUIRED'));
    const res = await GET(new Request('https://dsg.pics/api/dsg/agent-chat'));
    expect(res.status).toBe(401);
    expect(history).not.toHaveBeenCalled();
  });

  it('does not fabricate an empty chat when the existing memory database is unavailable', async () => {
    history.mockRejectedValueOnce(new Error('APP_BUILDER_DB_UPSTREAM_UNAVAILABLE'));
    const res = await GET(new Request('https://dsg.pics/api/dsg/agent-chat'));
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('DSG_CHAT_HISTORY_UNAVAILABLE');
  });
});
