import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { POST } from '@/app/api/dsg/agent-chat/route';

const root = process.cwd();

describe('AWS native Workroom governance', () => {
  it('fails agent chat closed without authenticated workspace context', async () => {
    const response = await POST(new Request('http://localhost/api/dsg/agent-chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'status' }),
    }));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ ok: false, error: { code: 'DSG_AUTH_REQUIRED' } });
  });

  it('binds chat memory to verified actor and workspace instead of client identity headers', () => {
    const route = readFileSync(join(root, 'app/api/dsg/agent-chat/route.ts'), 'utf8');
    const memory = readFileSync(join(root, 'lib/dsg/agent-runtime/persistent-chat-memory.ts'), 'utf8');
    const chat = readFileSync(join(root, 'components/live-agent-chat.tsx'), 'utf8');

    expect(route).toContain("requireVerifiedDsgActor(req.headers, 'job:read')");
    expect(route).toContain('verifiedIdentity');
    expect(memory).toContain('verifiedIdentity?: AgentChatVerifiedIdentity');
    expect(chat).toContain("credentials: 'include'");
    expect(chat).not.toContain("'x-dsg-workspace-id': 'dsg-one-v1-customer-workspace'");
    expect(chat).not.toContain("'x-dsg-actor-id': 'dsg-agent-chat-user'");
  });

  it('publishes Workroom only behind the existing authenticated workspace flow', () => {
    const page = readFileSync(join(root, 'app/dsg/workroom/page.tsx'), 'utf8');

    expect(page).toContain("fetch('/api/dsg/access/session'");
    expect(page).toContain("fetch('/api/dsg/access/workspace'");
    expect(page).toContain("window.location.assign('/login?next=/dsg/workroom')");
    expect(page).toContain('<LiveAgentChat />');
    expect(page).toContain('Spacetime remains execution authority');
    expect(page).not.toMatch(/azurecontainerapps\.io|westus3|appdeploy\.ai/i);
  });
});
