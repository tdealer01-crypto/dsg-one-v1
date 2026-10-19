import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { POST } from '@/app/api/dsg/agent-chat/route';
import { POST as routeCommandPost } from '@/app/api/dsg/agent-runtime/commands/route';

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

  it('fails command routing closed without authenticated workspace context', async () => {
    const response = await routeCommandPost(new Request('http://localhost/api/dsg/agent-runtime/commands', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ command: 'status' }),
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
    const commandCenter = readFileSync(join(root, 'components/agent-command-center.tsx'), 'utf8');
    const commandRoute = readFileSync(join(root, 'app/api/dsg/agent-runtime/commands/route.ts'), 'utf8');

    expect(page).toContain("fetch('/api/dsg/access/session'");
    expect(page).toContain("fetch('/api/dsg/access/workspace'");
    expect(page).toContain("window.location.assign('/login?next=/dsg/workroom')");
    expect(page).toContain('<DsgLiveWorkroom key={selected.workspace_id} />');
    expect(page).toContain('<AgentCommandCenter />');
    // The user-facing screen is chat-first; the technical workroom is still
    // accessible behind an on-demand admin section, not deleted or duplicated.
    expect(page).toContain('<DsgOperatorChat key={selected.workspace_id} />');
    expect(page).toContain('advancedOpen && (');
    expect(page).toContain('<DsgLiveWorkroom key={selected.workspace_id} />');
    const workroom = readFileSync(join(root, 'components/dsg-live-workroom.tsx'), 'utf8');
    expect(workroom).toContain("'node.agent.dsg-v0'");
    expect(workroom).toContain("'action.plan'");
    expect(workroom).toContain("tool('spacetime_capability_catalog', {})");
    expect(commandRoute).toContain("requireVerifiedDsgActor(req.headers, 'job:read')");
    expect(commandCenter).toContain("credentials: 'include'");
    expect(commandCenter).toContain("deploy: 'none'");
    expect(readFileSync(join(root, 'components/dsg-live-workroom.tsx'), 'utf8')).toContain("tool('spacetime_capability_catalog', {})");
    expect(commandCenter).not.toContain("'x-dsg-workspace-id': '00000000-0000-4000-8000-000000000001'");
    expect(commandCenter).not.toContain("'x-dsg-actor-id': 'customer'");
    expect(page).not.toMatch(/azurecontainerapps\.io|westus3|appdeploy\.ai/i);
  });

  it('pins desktop work to DSG Native without hosted RDC fallback', () => {
    const page = readFileSync(join(root, 'app/dsg/workroom/page.tsx'), 'utf8');
    const workroom = readFileSync(join(root, 'components/dsg-live-workroom.tsx'), 'utf8');

    expect(workroom).toContain("const desktopTarget = 'node.desktop-native'");
    expect(workroom).toContain('DSG_NATIVE_DESKTOP_NOT_ENROLLED');
    expect(workroom).toContain('uniqueWorkroomRoute(available, step.capability, step.target)');
    expect(workroom).not.toContain('node.rdc-remote');
    expect(page).not.toContain('mcp.desktopcommander.app');
    expect(page).toContain('<DsgLiveWorkroom key={selected.workspace_id} />');
    // The canonical desktop route remains pinned to DSG Native only.
    expect(workroom).toContain("'node.desktop-native'");
    expect(workroom).not.toContain('mcp.desktopcommander.app');
  });
});
