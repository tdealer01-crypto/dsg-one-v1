import type {
  RemoteBrowserArtifact,
  RemoteBrowserCheckpoint,
  RemoteBrowserCreateSessionInput,
  RemoteBrowserNavigationEvent,
  RemoteBrowserSession,
} from './types';
import { getRemoteBrowserProvider } from './provider-registry';

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

export function createRemoteBrowserSession(input: RemoteBrowserCreateSessionInput): RemoteBrowserSession {
  const provider = getRemoteBrowserProvider(input.providerId);
  const createdAt = now();
  const session: RemoteBrowserSession = {
    id: id('rb'),
    providerId: provider.id,
    status: provider.status === 'missing_env' ? 'blocked' : 'created',
    goal: input.goal,
    startUrl: input.startUrl,
    currentUrl: input.startUrl,
    createdAt,
    updatedAt: createdAt,
    navigationLog: [
      event({
        action: 'session.create',
        status: provider.status === 'missing_env' ? 'blocked' : 'completed',
        url: input.startUrl,
        detail: provider.status === 'missing_env'
          ? `Provider ${provider.id} is missing required env: ${provider.requiredEnv.join(', ')}`
          : `Provider ${provider.id} has env but executor adapter is pending. Session contract created only.`,
      }),
    ],
    artifacts: [],
    checkpoints: provider.status === 'missing_env'
      ? [{
          id: id('checkpoint'),
          type: 'takeover',
          state: 'active',
          instruction: `Configure required env for ${provider.label}: ${provider.requiredEnv.join(', ')}`,
          createdAt,
        }]
      : [],
  };
  sessions.set(session.id, session);
  return session;
}

export function listRemoteBrowserSessions(): RemoteBrowserSession[] {
  return Array.from(sessions.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getRemoteBrowserSession(sessionId: string): RemoteBrowserSession {
  const session = sessions.get(sessionId);
  if (!session) throw new Error('REMOTE_BROWSER_SESSION_NOT_FOUND');
  return session;
}

export function appendRemoteBrowserNavigation(input: {
  sessionId: string;
  action: RemoteBrowserNavigationEvent['action'];
  status: RemoteBrowserNavigationEvent['status'];
  url?: string;
  detail: string;
}): RemoteBrowserSession {
  const session = getRemoteBrowserSession(input.sessionId);
  session.navigationLog.push(event({ action: input.action, status: input.status, url: input.url, detail: input.detail }));
  session.currentUrl = input.url ?? session.currentUrl;
  session.status = input.status === 'blocked' ? 'blocked' : input.status === 'failed' ? 'failed' : session.status;
  session.updatedAt = now();
  sessions.set(session.id, session);
  return session;
}

export function addRemoteBrowserArtifact(input: Omit<RemoteBrowserArtifact, 'id' | 'createdAt'> & { sessionId: string }): RemoteBrowserSession {
  const session = getRemoteBrowserSession(input.sessionId);
  session.artifacts.push({
    id: id('artifact'),
    type: input.type,
    status: input.status,
    title: input.title,
    detail: input.detail,
    url: input.url,
    createdAt: now(),
  });
  session.navigationLog.push(event({ action: 'screenshot.request', status: input.status === 'available' ? 'completed' : input.status, detail: input.detail, url: input.url }));
  session.updatedAt = now();
  sessions.set(session.id, session);
  return session;
}

export function addRemoteBrowserCheckpoint(input: Omit<RemoteBrowserCheckpoint, 'id' | 'createdAt'> & { sessionId: string }): RemoteBrowserSession {
  const session = getRemoteBrowserSession(input.sessionId);
  session.checkpoints.push({
    id: id('checkpoint'),
    type: input.type,
    state: input.state,
    instruction: input.instruction,
    resolvedAt: input.resolvedAt,
    createdAt: now(),
  });
  session.status = input.state === 'active' ? 'blocked' : session.status;
  session.navigationLog.push(event({ action: 'checkpoint.create', status: input.state === 'active' ? 'blocked' : 'completed', detail: input.instruction }));
  session.updatedAt = now();
  sessions.set(session.id, session);
  return session;
}

export function resolveRemoteBrowserCheckpoint(input: { sessionId: string; checkpointId: string; detail?: string }): RemoteBrowserSession {
  const session = getRemoteBrowserSession(input.sessionId);
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
