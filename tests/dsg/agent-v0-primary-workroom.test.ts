import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { middleware } from '../../middleware';
import { NextRequest } from 'next/server';

const source = (name: string) => readFileSync(join(process.cwd(), name), 'utf8');

describe('new DSG Agent v0 governed Workroom entry', () => {
  it('shows one first-class Agent v0 entry on desktop/mobile landing and Workroom', () => {
    const landing = source('app/page.tsx');
    const workroom = source('app/dsg/workroom/page.tsx');
    const access = source('app/dsg/access/page.tsx');
    expect(landing).toContain("title: 'DSG Agent v0 · Qwen Planner'");
    expect(landing).toContain('href="/dsg/workroom?tool=agent-v0"');
    expect(workroom).toContain('วางแผนด้วย DSG Agent v0 (Qwen)');
    expect(workroom).toContain("next.searchParams.set('tool', 'agent-v0')");
    expect(workroom).toContain("tool === 'agent-v0'");
    expect(access).toContain("href: '/dsg/workroom?tool=agent-v0'");
  });

  it('retains the chosen Agent tab through existing protected site login', () => {
    const res = middleware(new NextRequest('https://dsg.pics/dsg/workroom?tool=agent-v0'));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).searchParams.get('next')).toBe('/dsg/workroom?tool=agent-v0');
    const workroom = source('app/dsg/workroom/page.tsx');
    expect(workroom).toContain("window.location.assign('/login?next=' + encodeURIComponent(returnTo))");
    expect(workroom).toContain('isToolDeepLink');
  });

  it('reuses governed action.plan, not an invented Qwen chat model', () => {
    const live = source('components/dsg-live-workroom.tsx');
    const chatModel = source('lib/dsg/agent-runtime/chat-model.ts');
    expect(live).toContain("run('action.plan', 'node.agent.dsg-v0'");
    expect(live).toContain("result.authority !== 'proposal-only'");
    expect(live).toContain("result.model.startsWith('DSG-Agent-v0')");
    expect(live).toContain("reason.includes('DSG_BRAIN_BASE_URL_INVALID')");
    expect(live).toContain('ไม่มีการเรียกโมเดลจำลองหรือ GPU เสียเงิน');
    expect(chatModel).toContain('dsgV0ChatBound: false');
    expect(live).not.toContain('DSG_BRAIN_BASE_URL=https://');
    expect(live).not.toContain('localStorage.setItem');
  });
});
