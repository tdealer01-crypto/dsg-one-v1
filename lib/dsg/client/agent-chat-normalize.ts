const FALLBACK_REPLY = 'โมเดลตอบกลับในรูปแบบที่ UI ไม่รองรับ ลองใหม่อีกครั้งหรือตรวจ runtime evidence ครับ';

function textCandidate(value: unknown): string | null {
  if (typeof value === 'string') {
    const text = value.trim();
    return text || null;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  for (const key of ['reply', 'text', 'content', 'outputText', 'message']) {
    const candidate = record[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return null;
}

export function normalizeAgentChatReply(value: unknown): string {
  const direct = textCandidate(value);
  if (direct) return direct;

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => textCandidate(item))
      .filter((item): item is string => Boolean(item));
    if (parts.length) return parts.join('\n');
  }

  return FALLBACK_REPLY;
}

export function normalizeAgentChatMemoryStatus(value: unknown): string {
  if (typeof value !== 'string') return 'memory unknown';
  const status = value.trim();
  return status ? `memory ${status}` : 'memory unknown';
}
