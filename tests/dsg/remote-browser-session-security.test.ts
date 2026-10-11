import {describe, expect, it} from 'vitest';
import {
  createRemoteBrowserSession,
  listRemoteBrowserSessions,
  getRemoteBrowserSession,
  appendRemoteBrowserNavigation,
  addRemoteBrowserArtifact,
  resolveRemoteBrowserCheckpoint,
} from '../../lib/dsg/remote-browser/session-store';
import {GET as listSessions, POST as createSession} from '../../app/api/dsg/remote-browser/sessions/route';
import {GET as getNavigation, POST as addNavigation} from '../../app/api/dsg/remote-browser/sessions/[sessionId]/navigation/route';
import {GET as getArtifacts, POST as addArtifact} from '../../app/api/dsg/remote-browser/sessions/[sessionId]/artifacts/route';
import {GET as getCheckpoints, POST as addCheckpoint} from '../../app/api/dsg/remote-browser/sessions/[sessionId]/checkpoints/route';
import {POST as resolveCheckpoint} from '../../app/api/dsg/remote-browser/sessions/[sessionId]/checkpoints/[checkpointId]/resolve/route';

const owner = {actorId: 'alice', workspaceId: 'workspace-alpha'};
const otherActor = {actorId: 'bob', workspaceId: 'workspace-alpha'};
const otherWorkspace = {actorId: 'alice', workspaceId: 'workspace-beta'};

describe('DSG remote-browser draft session security', () => {
  it('never reports an unimplemented provider as an active browser session', () => {
    const session = createRemoteBrowserSession({
      goal: 'inspect only',
      startUrl: 'https://example.com',
      providerId: 'playwright',
    }, owner);
    expect(session.status).toBe('blocked');
    expect(session.navigationLog[0]?.status).toBe('blocked');
    expect(session.checkpoints.some(item => item.state === 'active')).toBe(true);
  });

  it('isolates all session reads by actor AND workspace', () => {
    const session = createRemoteBrowserSession({
      goal: 'self-test scoped ownership', startUrl: 'https://example.com', providerId: 'playwright',
    }, owner);
    expect(listRemoteBrowserSessions(owner).some(item => item.id === session.id)).toBe(true);
    expect(listRemoteBrowserSessions(otherActor).some(item => item.id === session.id)).toBe(false);
    expect(listRemoteBrowserSessions(otherWorkspace).some(item => item.id === session.id)).toBe(false);
    expect(() => getRemoteBrowserSession(session.id, otherActor)).toThrow('REMOTE_BROWSER_SESSION_NOT_FOUND');
    expect(() => getRemoteBrowserSession(session.id, otherWorkspace)).toThrow('REMOTE_BROWSER_SESSION_NOT_FOUND');
  });

  it('rejects invented completed browser runs and unverified screenshots', () => {
    const session = createRemoteBrowserSession({
      goal: 'evidence guard test', startUrl: 'https://example.com', providerId: 'playwright',
    }, owner);
    expect(() => appendRemoteBrowserNavigation({
      sessionId: session.id, owner, action: 'navigate', status: 'completed',
      detail: 'pretend action completed',
    })).toThrow('REMOTE_BROWSER_PROVIDER_EXECUTION_NOT_VERIFIED');
    expect(() => addRemoteBrowserArtifact({
      sessionId: session.id, owner, type: 'screenshot', status: 'available',
      title: 'fake proof', detail: 'not captured',
    })).toThrow('REMOTE_BROWSER_ARTIFACT_NOT_VERIFIED');
    expect(() => resolveRemoteBrowserCheckpoint({
      sessionId: session.id, owner, checkpointId: session.checkpoints[0]!.id,
    })).toThrow('REMOTE_BROWSER_PROVIDER_EXECUTION_NOT_VERIFIED');
  });

  it('rejects unauthenticated access before reading or mutating any session endpoint', async () => {
    const request = (method: 'GET'|'POST') => new Request('https://dsg.pics/api/dsg/remote-browser/sessions', {method});
    const context = {params: Promise.resolve({sessionId: 'not-a-session', checkpointId: 'not-a-checkpoint'})};
    const responses = [
      await listSessions(request('GET')),
      await createSession(request('POST')),
      await getNavigation(request('GET'), context),
      await addNavigation(request('POST'), context),
      await getArtifacts(request('GET'), context),
      await addArtifact(request('POST'), context),
      await getCheckpoints(request('GET'), context),
      await addCheckpoint(request('POST'), context),
      await resolveCheckpoint(request('POST'), context),
    ];
    for (const response of responses) {
      expect(response.status).toBe(401);
      const body = await response.json() as {ok: boolean; error?: {code: string}};
      expect(body.ok).toBe(false);
      expect(body.error?.code).toBe('DSG_AUTH_REQUIRED');
    }
  });
});
