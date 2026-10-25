import { describe, expect, it, vi } from 'vitest';
import { resolveCinemaViewerUrl } from '@/lib/dsg/user-bound/cinema-viewer-session';

const sessionId = 'verified-fixture-session';
const status = { ok: true, remote_enabled: true, agent_connection: 'connected',
  shared_browser: { provider: 'self_hosted_playwright', connected: true, browser_session_id: sessionId } };
const account = { ok: true, linked: true, account: { plan: 'free' } };
const viewer = { ok: true, connected: true, provider: 'self_hosted_playwright',
  browser_session_id: sessionId, embed_url: '/remote-browser/self-hosted/view/local_fixture_viewer_1234567890' };

function reads(statusValue: unknown = status, accountValue: unknown = account, viewerValue: unknown = viewer) {
  return { readGovernedStatus: vi.fn(async () => statusValue), readAccountStatus: vi.fn(async () => accountValue),
    readViewer: vi.fn(async () => viewerValue) };
}

describe('same-session Cinema human viewer', () => {
  it('opens only the exact AWS viewer after fresh governed status and linked-account checks', async () => {
    const source = reads();
    await expect(resolveCinemaViewerUrl(source)).resolves.toBe('https://aws.dsg.pics' + viewer.embed_url);
    expect(source.readGovernedStatus.mock.invocationCallOrder[0]).toBeLessThan(source.readAccountStatus.mock.invocationCallOrder[0]);
    expect(source.readAccountStatus.mock.invocationCallOrder[0]).toBeLessThan(source.readViewer.mock.invocationCallOrder[0]);
  });

  it('refuses a different human session even when both browser responses are connected', async () => {
    await expect(resolveCinemaViewerUrl(reads(status, account, { ...viewer, browser_session_id: 'other-session' })))
      .rejects.toThrow('CINEMA_VIEWER_SESSION_MISMATCH');
  });

  it.each([null, { ...status, ok: false }, { ...status, remote_enabled: false },
    { ...status, agent_connection: 'disconnected' }, { ...status, shared_browser: { ...status.shared_browser, connected: false } },
    { ...status, shared_browser: { ...status.shared_browser, provider: 'other' } },
    { ...status, shared_browser: { ...status.shared_browser, browser_session_id: '' } }])
  ('does not issue any viewer request for missing/unverified governed status %#', async value => {
    const source = reads(value);
    await expect(resolveCinemaViewerUrl(source)).rejects.toThrow('SAME_ACCOUNT_BROWSER_VIEWER_NOT_READY');
    expect(source.readAccountStatus).not.toHaveBeenCalled();
    expect(source.readViewer).not.toHaveBeenCalled();
  });

  it('keeps first-time account proof required and never silently creates or links an account', async () => {
    const source = reads(status, { ...account, linked: false });
    await expect(resolveCinemaViewerUrl(source)).rejects.toThrow('CINEMA_FREE_ACCOUNT_NOT_LINKED');
    expect(source.readViewer).not.toHaveBeenCalled();
  });

  it.each(['https://other.test/remote-browser/self-hosted/view/local_fixture_viewer_1234567890',
    '//other.test/view', '/remote-browser/self-hosted/view/local_fixture_viewer_1234567890?token=x',
    '/remote-browser/self-hosted/view/local_fixture_viewer_1234567890#token', '[REDACTED]'])
  ('rejects other origins and unexpected private-viewer formats %#', async embed_url => {
    await expect(resolveCinemaViewerUrl(reads(status, account, { ...viewer, embed_url })))
      .rejects.toThrow('SAME_ACCOUNT_BROWSER_VIEWER_NOT_READY');
  });

  it('does not infer a hosting provider from a historical session-ID prefix', async () => {
    const id = 'azure-legacy-fixture-session';
    await expect(resolveCinemaViewerUrl(reads(
      { ...status, shared_browser: { ...status.shared_browser, browser_session_id: id } },
      account, { ...viewer, browser_session_id: id }))).resolves.toBe('https://aws.dsg.pics' + viewer.embed_url);
  });

  it.each([{ ...viewer, ok: false }, { ...viewer, connected: false },
    { ...viewer, provider: 'other' }, { ...viewer, browser_session_id: '' }])
  ('refuses an unverified human viewer response %#', async value => {
    await expect(resolveCinemaViewerUrl(reads(status, account, value)))
      .rejects.toThrow('SAME_ACCOUNT_BROWSER_VIEWER_NOT_READY');
  });

  it('does not swallow or retry an upstream failure', async () => {
    const source = reads();
    source.readGovernedStatus.mockRejectedValueOnce(new Error('EXACT_PROVIDER_RECEIPT_NOT_VERIFIED'));
    await expect(resolveCinemaViewerUrl(source)).rejects.toThrow('EXACT_PROVIDER_RECEIPT_NOT_VERIFIED');
    expect(source.readGovernedStatus).toHaveBeenCalledTimes(1);
    expect(source.readViewer).not.toHaveBeenCalled();
  });
});
