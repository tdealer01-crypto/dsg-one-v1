import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireVerifiedDsgActor: vi.fn(),
  getRuntimeJobTimeline: vi.fn(),
}));

// Keep the real token extractor while isolating authorization and database I/O.
vi.mock('@/lib/dsg/server/context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/dsg/server/context')>()),
  requireVerifiedDsgActor: mocks.requireVerifiedDsgActor,
}));
vi.mock('@/lib/dsg/server/repository', () => ({
  getRuntimeJobTimeline: mocks.getRuntimeJobTimeline,
}));

import { GET } from '@/app/api/dsg/jobs/[jobId]/route';

const routeContext = { params: Promise.resolve({ jobId: 'job-1' }) };

describe('DSG Workroom job evidence reads', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireVerifiedDsgActor.mockResolvedValue({
      workspaceId: 'workspace-1',
      actorId: 'actor-1',
      role: 'OWNER',
    });
    mocks.getRuntimeJobTimeline.mockResolvedValue({
      job: { id: 'job-1', workspaceId: 'workspace-1', status: 'CREATED' },
      events: [],
      evidenceItems: [],
    });
  });

  it('forwards the same HttpOnly cookie-backed token used to verify the actor', async () => {
    const request = new Request('https://dsg.pics/api/dsg/jobs/job-1', {
      headers: { cookie: 'sb-access-token=user.jwt.token; dsg-workspace-id=workspace-1' },
    });

    const response = await GET(request, routeContext);

    expect(response.status).toBe(200);
    expect(mocks.requireVerifiedDsgActor).toHaveBeenCalledWith(request.headers, 'job:read');
    expect(mocks.getRuntimeJobTimeline).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      actorId: 'actor-1',
      userAccessToken: 'user.jwt.token',
    }, 'job-1');
  });

  it('prefers an explicit bearer token to the cookie when both are present', async () => {
    const request = new Request('https://dsg.pics/api/dsg/jobs/job-1', {
      headers: {
        authorization: 'Bearer delegated.user.token',
        cookie: 'sb-access-token=cookie.user.token; dsg-workspace-id=workspace-1',
      },
    });

    const response = await GET(request, routeContext);

    expect(response.status).toBe(200);
    expect(mocks.getRuntimeJobTimeline).toHaveBeenCalledWith(expect.objectContaining({
      userAccessToken: 'delegated.user.token',
    }), 'job-1');
  });

  it('does not call the repository if verified user authorization fails', async () => {
    mocks.requireVerifiedDsgActor.mockRejectedValue(new Error('DSG_AUTH_REQUIRED'));
    const request = new Request('https://dsg.pics/api/dsg/jobs/job-1');

    await expect(GET(request, routeContext)).rejects.toThrow('DSG_AUTH_REQUIRED');
    expect(mocks.getRuntimeJobTimeline).not.toHaveBeenCalled();
  });
});
