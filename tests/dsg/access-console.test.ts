import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDsgUserAccessToken, resolveVerifiedDsgActor } from '@/lib/dsg/server/context';

const root = process.cwd();

describe('DSG access console session bridge', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv('DSG_ONE_V1_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY', 'service-role-test-key');
  });

  it('forwards the same cookie-backed user token used by verified actor auth', () => {
    const headers = new Headers({
      cookie: 'sb-access-token=user.jwt.token; dsg-workspace-id=workspace-1',
    });
    expect(getDsgUserAccessToken(headers)).toBe('user.jwt.token');
  });

  it('prefers an explicit bearer token over the session cookie', () => {
    const headers = new Headers({
      authorization: 'Bearer explicit.jwt.token',
      cookie: 'sb-access-token=cookie.jwt.token; dsg-workspace-id=workspace-1',
    });
    expect(getDsgUserAccessToken(headers)).toBe('explicit.jwt.token');
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

  it('supports Supabase sb_* service keys without sending them as bearer tokens', async () => {
    vi.stubEnv('DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY', 'sb_secret_test_key');

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'actor-1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ role: 'OWNER' }]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const actor = await resolveVerifiedDsgActor(new Headers({
      cookie: 'sb-access-token=user.jwt.token; dsg-workspace-id=workspace-1',
    }));

    expect(actor).toEqual({ actorId: 'actor-1', workspaceId: 'workspace-1', role: 'OWNER' });
    const membershipRequest = fetchMock.mock.calls[1];
    const requestInit = membershipRequest?.[1] as RequestInit | undefined;
    const headers = requestInit?.headers as Record<string, string> | undefined;
    expect(headers?.apikey).toBe('sb_secret_test_key');
    expect(headers?.Authorization).toBeUndefined();
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
    const login = readFileSync(join(root, 'app/login/page.tsx'), 'utf8');
    const workspaceRoute = readFileSync(join(root, 'app/api/dsg/access/workspace/route.ts'), 'utf8');
    const openRouter = readFileSync(join(root, 'lib/dsg/app-builder/adapters/openrouter/openrouter-client.ts'), 'utf8');
    const services = readFileSync(join(root, 'lib/dsg/agent-runtime/service-registry.ts'), 'utf8');
    const ship = readFileSync(join(root, '.github/workflows/ship.yml'), 'utf8');

    for (const name of ['App Builder', 'Governance Controls', 'Runtime Health', 'Spacetime MCP', 'Workroom', 'Cinema / Browser', 'Agent v0 / NVIDIA Skills', 'Agent Repair']) {
      expect(page).toContain(name);
    }
    expect(page).toContain('Spacetime remains execution authority');
    expect(page).toContain('Agent Repair is proposal-only');
    expect(page).toContain('Free Kaggle GPU · proposal');
    expect(page).toContain('fails closed instead of falling back to a paid GPU provider');
    expect(page).toContain('https://www.kaggle.com/code/taraaaa1111/dsg-agent-v0-qwen3-30b-a3b-t4x2');
    expect(page).toContain("href: '/dsg/app-builder'");
    expect(page).toContain("href: '/dsg/governance'");
    expect(page).toContain("href: '/api/agent/status'");
    expect(page).toContain('https://aws.dsg.pics/mcp');
    expect(page).toContain("href: '/dsg/workroom'");
    expect(page).toContain('Authenticated AWS workroom');
    expect(page).toContain("href: 'https://aws.dsg.pics/app'");
    expect(page).toContain("href: null");
    expect(page).toContain('No verified AWS operator UI route');
    expect(page).toContain('APP HEALTHY');
    expect(page).not.toMatch(/azurecontainerapps\.io|westus3|Azure Key Vault|appdeploy\.ai/i);
    expect(login).not.toContain('Azure Key Vault');
    expect(openRouter).toContain("const DEFAULT_SITE_URL = 'https://dsg.pics'");
    expect(openRouter).not.toContain('azurewebsites.net');
    expect(services).toContain("id: 'aws.deployment.proof'");
    expect(services).not.toContain("id: 'azure.deployment.proof'");
    expect(services).toContain("status: 'connector_required'");
    expect(ship).toContain('DSG_PRODUCTION_URL: https://dsg.pics');
    expect(ship).toContain('RELEASE_SOURCE_AND_CI=PASS');
    expect(ship).toContain('BLOCK=EC2_NOT_RUNNING');
    expect(ship).toContain('BLOCK=PUBLIC_SERVING_SHA_MISMATCH');
    expect(ship).toContain('RELEASE=ROLLBACK_ATTEMPTED');
    expect(ship).toContain('DSG_ONE_ON_HOST_RELEASE=PASS');
    expect(ship).not.toContain('aws ec2 start-instances');
    expect(ship).not.toContain('azurewebsites.net');
    expect(workspaceRoute).toContain('DSG_WORKSPACE_MEMBERSHIP_REQUIRED');
    expect(workspaceRoute).toContain("response.cookies.set('dsg-workspace-id'");
  });
});
