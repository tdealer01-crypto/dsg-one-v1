import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveVerifiedDsgActor } from '@/lib/dsg/server/context';

const root = process.cwd();

describe('DSG access console session bridge', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv('DSG_ONE_V1_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY', 'service-role-test-key');
  });

  it('resolves actor and workspace from secure session cookies', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'actor-1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ role: 'OWNER' }]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const actor = await resolveVerifiedDsgActor(new Headers({
      cookie: 'sb-access-token=user.jwt.token; dsg-workspace-id=workspace-1',
    }));

    expect(actor).toEqual({ actorId: 'actor-1', workspaceId: 'workspace-1', role: 'OWNER' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fails closed when the workspace cookie is absent', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const actor = await resolveVerifiedDsgActor(new Headers({
      cookie: 'sb-access-token=user.jwt.token',
    }));

    expect(actor).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps login tokens out of client JavaScript', () => {
    const login = readFileSync(join(root, 'app/login/page.tsx'), 'utf8');
    const authRoute = readFileSync(join(root, 'app/api/auth/session/route.ts'), 'utf8');

    expect(login).toContain("fetch('/api/auth/session'");
    expect(login).not.toContain('document.cookie');
    expect(authRoute).toContain("httpOnly: true");
    expect(authRoute).toContain("response.cookies.set('sb-access-token'");
  });

  it('publishes the authenticated access surface and governance boundaries', () => {
    const page = readFileSync(join(root, 'app/dsg/access/page.tsx'), 'utf8');
    const workspaceRoute = readFileSync(join(root, 'app/api/dsg/access/workspace/route.ts'), 'utf8');

    for (const name of ['Workroom', 'Spacetime MCP', 'Cinema', 'Azure Browser', 'Agent Repair', 'Status / Evidence']) {
      expect(page).toContain(name);
    }
    expect(page).toContain('Spacetime remains execution authority');
    expect(page).toContain('Agent Repair is proposal-only');
    expect(workspaceRoute).toContain('DSG_WORKSPACE_MEMBERSHIP_REQUIRED');
    expect(workspaceRoute).toContain("response.cookies.set('dsg-workspace-id'");
  });
});
