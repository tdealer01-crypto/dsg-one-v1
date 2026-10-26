import { asRecord } from './workroom-contract';

const CINEMA_ORIGIN = 'https://aws.dsg.pics';
const VIEWER = /^\/remote-browser\/self-hosted\/view\/[A-Za-z0-9_-]{20,128}$/;

type ViewerReads = {
  readGovernedStatus: () => Promise<unknown>;
  readAccountStatus: () => Promise<unknown>;
  readViewer: () => Promise<unknown>;
};

// The caller verifies the fresh governed status receipt for the current user.
// A viewer's nonempty ID is insufficient: human and agent must share that ID.
// Return the private viewer URL only to the user's popup, never to audit/logs.
export async function resolveCinemaViewerUrl(reads: ViewerReads): Promise<string> {
  const status = asRecord(await reads.readGovernedStatus());
  const shared = asRecord(status?.shared_browser);
  const sessionId = shared?.browser_session_id;
  if (status?.ok !== true || status.remote_enabled !== true ||
      status.agent_connection !== 'connected' || shared?.connected !== true ||
      shared.provider !== 'self_hosted_playwright' || typeof sessionId !== 'string' || !sessionId.trim()) {
    throw new Error('SAME_ACCOUNT_BROWSER_VIEWER_NOT_READY');
  }

  const account = asRecord(await reads.readAccountStatus());
  if (account?.ok !== true || account.linked !== true || asRecord(account.account)?.plan !== 'free') {
    throw new Error('CINEMA_FREE_ACCOUNT_NOT_LINKED');
  }

  const viewer = asRecord(await reads.readViewer());
  if (viewer?.ok !== true || viewer.connected !== true || viewer.provider !== 'self_hosted_playwright' ||
      typeof viewer.browser_session_id !== 'string' || !viewer.browser_session_id ||
      typeof viewer.embed_url !== 'string' || !VIEWER.test(viewer.embed_url)) {
    throw new Error('SAME_ACCOUNT_BROWSER_VIEWER_NOT_READY');
  }
  if (viewer.browser_session_id !== sessionId) throw new Error('CINEMA_VIEWER_SESSION_MISMATCH');
  return CINEMA_ORIGIN + viewer.embed_url;
}
