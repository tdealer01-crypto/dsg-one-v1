import { describe, expect, it } from 'vitest';
import { normalizeAgentChatMemoryStatus, normalizeAgentChatReply } from '@/lib/dsg/client/agent-chat-normalize';

describe('agent chat client response normalization', () => {
  it('keeps ordinary string replies', () => {
    expect(normalizeAgentChatReply('runtime healthy')).toBe('runtime healthy');
  });

  it('extracts text from structured reply objects instead of passing objects to React', () => {
    expect(normalizeAgentChatReply({ text: 'structured runtime reply' })).toBe('structured runtime reply');
    expect(normalizeAgentChatReply({ content: 'content reply' })).toBe('content reply');
  });

  it('joins textual structured arrays and never returns a non-string', () => {
    const reply = normalizeAgentChatReply([{ text: 'one' }, { content: 'two' }]);
    expect(reply).toBe('one\ntwo');
    expect(typeof reply).toBe('string');
  });

  it('fails visibly but safely for unsupported/null payloads', () => {
    expect(typeof normalizeAgentChatReply(null)).toBe('string');
    expect(typeof normalizeAgentChatReply({ nested: { value: 1 } })).toBe('string');
  });

  it('normalizes memory status without interpolating arbitrary objects', () => {
    expect(normalizeAgentChatMemoryStatus('active')).toBe('memory active');
    expect(normalizeAgentChatMemoryStatus({ status: 'active' })).toBe('memory unknown');
  });
});
