import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  prepare: vi.fn(),
  execute: vi.fn(),
}));

vi.mock('@/lib/dsg/server/context', () => ({
  requireVerifiedDsgActor: mocks.authorize,
}));
vi.mock('@/lib/dsg/tools/governed-tools', () => ({
  prepareGovernedToolRequest: mocks.prepare,
  executeGovernedToolRequest: mocks.execute,
}));

import { POST } from '@/app/api/dsg/tools/route';

function request(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new Request('https://dsg.pics/api/dsg/tools', {
    method: 'POST',
    headers: { origin: 'https://dsg.pics', 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.authorize.mockResolvedValue({
    actorId: 'verified-user-uuid', workspaceId: 'verified-workspace-uuid', role: 'OPERATOR',
  });
  mocks.prepare.mockReturnValue({ ok: true, status: 'ready' });
});

describe('HTTP governed tools security boundary', () => {
  it('denies unauthenticated callers even when they spoof actor and role headers', async () => {
    mocks.authorize.mockRejectedValueOnce(new Error('DSG_AUTH_REQUIRED'));
    const result = await POST(request({ tool: 'shell', action: 'exec', execute: true },
      { 'x-dsg-actor-role': 'OWNER', 'x-dsg-workspace-id': 'another-workspace' }));
    expect(result.status).toBe(401);
    expect(mocks.authorize).toHaveBeenCalledWith(expect.any(Headers), 'job:plan');
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.prepare).not.toHaveBeenCalled();
  });

  it('denies real users without required workspace permission', async () => {
    mocks.authorize.mockRejectedValueOnce(new Error('DSG_PERMISSION_DENIED'));
    expect((await POST(request({ tool: 'file', action: 'write', execute: true }))).status).toBe(403);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('blocks HTTP execution even when the browser sets approved=true', async () => {
    const response = await POST(request({
      tool: 'api', action: 'create', goal: 'Write', execute: true, approved: true,
      args: { url: 'https://example.com', approved: true },
    }));
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe('DSG_SIGNED_EXECUTION_AUTHORITY_REQUIRED');
    expect(mocks.prepare).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('allows authenticated inspect-only requests but strips untrusted approval and paths', async () => {
    const response = await POST(request({
      tool: 'browser', action: 'navigate', goal: 'Inspect public page',
      approved: true, sandboxRoot: '/',
      args: { url: 'https://example.com', approved: true, sandboxRoot: '/etc' },
    }));
    expect(response.status).toBe(200);
    expect(mocks.prepare).toHaveBeenCalledOnce();
    const inspected = mocks.prepare.mock.calls[0][0];
    expect(inspected.args.approved).toBeUndefined();
    expect(inspected.args.sandboxRoot).toBeUndefined();
    expect(inspected.sandboxRoot).toBeUndefined();
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('rejects untrusted origins before auth or execution', async () => {
    expect((await POST(request({ tool: 'plan', action: 'read' },
      { origin: 'https://evil.example' }))).status).toBe(403);
    expect(mocks.authorize).not.toHaveBeenCalled();
  });
});
