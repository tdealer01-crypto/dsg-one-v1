import type {
  RemoteBrowserArtifact,
  RemoteBrowserCheckpoint,
  RemoteBrowserCreateSessionInput,
  RemoteBrowserNavigationEvent,
  RemoteBrowserSession,
} from './types';
import { getRemoteBrowserProvider } from './provider-registry';
import type { DsgServerActor } from '../server/context';

export type BrowserSessionOwner = Pick<DsgServerActor, 'actorId' | 'workspaceId'>;

const sessions = new Map<string, RemoteBrowserSession>();

function now() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function event(input: Omit<RemoteBrowserNavigationEvent, 'id' | 'at'>): RemoteBrowserNavigationEvent {
  return { id: id('nav'), at: now(), ...input };
}

export function createRemoteBrowserSession(input: RemoteBrowserCreateSessionInput, owner: BrowserSessionOwner): RemoteBrowserSession {
  const provider = getRemoteBrowserProvider(input.providerId);
  const createdAt = now();
  const session: RemoteBrowserSession = {
    id: id('rb'),
    ownerActorId: owner.actorId,
    workspaceId: owner.workspaceId,
    providerId: provider.id,
    // Env presence is not an executor proof: all current adapters are unverified drafts.
    status: 'blocked',
    goal: input.goal,
    startUrl: input.startUrl,
    currentUrl: input.startUrl,
    createdAt,
    updatedAt: createdAt,
    navigationLog: [
      event({
        action: 'session.create',
        status: 'blocked',
        url: input.startUrl,
        detail: provider.status === 'missing_env'
          ? `Provider ${provider.id} is missing required env: ${provider.requiredEnv.join(', ')}`
          : `Provider ${provider.id} has env but executor adapter is pending. Session contract created only.`,
      }),
    ],
    artifacts: [],
    checkpoints: [{
          id: id('checkpoint'),
          type: 'takeover',
          state: 'active',
          instruction: provider.status === 'missing_env'
            ? `Configure required env for ${provider.label}: ${provider.requiredEnv.join(', ')}`
            : `Provider ${provider.label} executor not verified; use the governed DSG Spacetime/Cinema route after a live acceptance.`,
          createdAt,
        }],
  };
  sessions.set(session.id, session);
  return session;
}

export function listRemoteBrowserSessions(owner: BrowserSessionOwner): RemoteBrowserSession[] {
  return Array.from(sessions.values())
    .filter((session) => session.ownerActorId === owner.actorId && session.workspaceId === owner.workspaceId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getRemoteBrowserSession(sessionId: string, owner: BrowserSessionOwner): RemoteBrowserSession {
  const session = sessions.get(sessionId);
  if (!session || session.ownerActorId !== owner.actorId || session.workspaceId !== owner.workspaceId) {
    throw new Error('REMOTE_BROWSER_SESSION_NOT_FOUND');
  }
  return session;
}

export function appendRemoteBrowserNavigation(input: {
  sessionId: string;
  owner: BrowserSessionOwner;
  action: RemoteBrowserNavigationEvent['action'];
  status: RemoteBrowserNavigationEvent['status'];
  url?: string;
  detail: string;
}): RemoteBrowserSession {
  const session = getRemoteBrowserSession(input.sessionId, input.owner);
  // An unverified draft adapter must not accept client-authored successful execution evidence.
  if (input.status === 'completed' || input.status === 'running') {
    throw new Error('REMOTE_BROWSER_PROVIDER_EXECUTION_NOT_VERIFIED');
  }
  session.navigationLog.push(event({ action: input.action, status: input.status, url: input.url, detail: input.detail }));
  // A failed or blocked browser action did not navigate the provider.
  session.status = input.status === 'blocked' ? 'blocked' : input.status === 'failed' ? 'failed' : session.status;
  session.updatedAt = now();
  sessions.set(session.id, session);
  return session;
}

export function addRemoteBrowserArtifact(input: Omit<RemoteBrowserArtifact, 'id' | 'createdAt'> & { sessionId: string; owner: BrowserSessionOwner }): RemoteBrowserSession {
  const session = getRemoteBrowserSession(input.sessionId, input.owner);
  if (input.status === 'available' && input.type !== 'manual_note') {
    throw new Error('REMOTE_BROWSER_ARTIFACT_NOT_VERIFIED');
  }
  session.artifacts.push({
    id: id('artifact'),
    type: input.type,
    status: input.status,
    title: input.title,
    detail: input.detail,
    url: input.url,
    createdAt: now(),
  });
  session.navigationLog.push(event({
    action: input.type === 'manual_note' ? 'note' : 'screenshot.request',
    status: input.type === 'manual_note' ? 'completed' : input.status === 'failed' ? 'failed' : 'blocked',
    detail: input.detail,
    url: input.url,
  }));
  session.updatedAt = now();
  sessions.set(session.id, session);
  return session;
}

export function addRemoteBrowserCheckpoint(input: Omit<RemoteBrowserCheckpoint, 'id' | 'createdAt'> & { sessionId: string; owner: BrowserSessionOwner }): RemoteBrowserSession {
  const session = getRemoteBrowserSession(input.sessionId, input.owner);
  if (input.state === 'resolved') throw new Error('REMOTE_BROWSER_CHECKPOINT_RESOLUTION_NOT_VERIFIED');
  session.checkpoints.push({
    id: id('checkpoint'),
    type: input.type,
    state: input.state,
    instruction: input.instruction,
    resolvedAt: input.resolvedAt,
    createdAt: now(),
  });
  session.status = input.state === 'active' ? 'blocked' : session.status;
  session.navigationLog.push(event({ action: 'checkpoint.create', status: 'blocked', detail: input.instruction }));
  session.updatedAt = now();
  sessions.set(session.id, session);
  return session;
}

export function resolveRemoteBrowserCheckpoint(input: { sessionId: string; owner: BrowserSessionOwner; checkpointId: string; detail?: string }): RemoteBrowserSession {
  const session = getRemoteBrowserSession(input.sessionId, input.owner);
  // A blocked draft cannot be resumed as a live session without verified provider execution.
  if (session.status !== 'running') {
    throw new Error('REMOTE_BROWSER_PROVIDER_EXECUTION_NOT_VERIFIED');
  }
  const checkpoint = session.checkpoints.find((item) => item.id === input.checkpointId);
  if (!checkpoint) throw new Error('REMOTE_BROWSER_CHECKPOINT_NOT_FOUND');
  checkpoint.state = 'resolved';
  checkpoint.resolvedAt = now();
  session.status = 'running';
  session.navigationLog.push(event({ action: 'checkpoint.resolve', status: 'completed', detail: input.detail ?? checkpoint.instruction }));
  session.updatedAt = now();
  sessions.set(session.id, session);
  return session;
}
