import 'server-only';
import { supabaseRest } from '@/lib/dsg/server/app-builder/supabase-rest';
import type { AgentChatVerifiedIdentity } from './persistent-chat-memory';

// The authenticated Supabase service-role client bypasses RLS: always pin
// BOTH workspace and actor from the independently verified site session.
// Never use actor/workspace IDs supplied in the query string or by the browser.
type ConversationRow = {
  id: string;
  actor_id: string;
  workspace_id: string;
  raw_text: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  status: string;
};

export type StoredChatTurn = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
};

export async function listAgentConversation(identity: AgentChatVerifiedIdentity): Promise<StoredChatTurn[]> {
  if (!identity.actorId || !identity.workspaceId) throw new Error('DSG_AUTH_REQUIRED');
  const filters = [
    `workspace_id=eq.${encodeURIComponent(identity.workspaceId)}`,
    `actor_id=eq.${encodeURIComponent(identity.actorId)}`,
    'source_type=eq.conversation',
    'status=not.in.(deleted,redacted)',
    'order=created_at.desc',
    'limit=100',
    'select=id,workspace_id,actor_id,raw_text,metadata,created_at,status',
  ];
  const rows = await supabaseRest<ConversationRow[]>({
    path: 'dsg_memory_events',
    query: `?${filters.join('&')}`,
  });

  return rows
    .filter(row =>
      row.workspace_id === identity.workspaceId &&
      row.actor_id === identity.actorId &&
      row.metadata?.source === 'live-agent-chat' &&
      (row.metadata?.role === 'user' || row.metadata?.role === 'assistant'))
    .reverse()
    .map(row => ({
      id: row.id,
      role: row.metadata!.role as StoredChatTurn['role'],
      text: row.raw_text.replace(/^\[(?:user|assistant)\] /, ''),
      createdAt: row.created_at,
    }))
    .filter(turn => Boolean(turn.text.trim()));
}
