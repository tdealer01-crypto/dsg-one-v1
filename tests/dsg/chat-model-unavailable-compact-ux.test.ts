import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const route = readFileSync(join(process.cwd(), 'app/api/dsg/agent-chat/route.ts'), 'utf8');
const fallback = route.slice(route.indexOf('function localFallbackReply('), route.indexOf('function authFailure('));

describe('Workroom unavailable model honesty and mobile readability', () => {
  it('renders brief unavailable status, never pseudo AI plan and technical dumps', () => {
    expect(fallback).toContain('ข้อความนี้เป็นสถานะระบบ ไม่ใช่คำตอบจากโมเดล');
    expect(fallback).toContain('ยังไม่ได้เชื่อมโมเดล AI');
    expect(fallback).toContain('DSG Agent v0 (Qwen)');
    expect(fallback).not.toContain('DSG_GRAPHIFY_CONTEXT_PROMPT');
    expect(fallback).not.toContain('Truth boundary:');
    expect(fallback).not.toContain('ลำดับมาตรฐานที่ระบบจะใช้: goal lock');
    expect(fallback).not.toContain('External tool ${');
  });
  it('keeps model failure explicit and reuses existing memory and workroom gates', () => {
    expect(route).toContain("modelStatus: 'unavailable'");
    expect(route).toContain("provider: 'none'");
    expect(route).toContain('fallback: true');
    expect(route).toContain('userMessage: \'\', agentReply: fallback.reply, history');
    expect(route).toContain("requireVerifiedDsgActor(req.headers, 'job:read')");
    expect(route).toContain('const userPersisted = await persistAgentChatTurn(');
    expect(route).toContain('const result = await runDsgChatModel(');
    expect(fallback).toContain('routeAgentCommand({');
  });
});
