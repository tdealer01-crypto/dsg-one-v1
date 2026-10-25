import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isVerifiedCinemaConnectResult,
  mayReuseRecentCinemaConnection,
} from '@/lib/dsg/user-bound/cinema-session-reuse';

describe('Workroom Cinema verified session reuse', () => {
  const connected = {
    ok: true, verified_connected: true,
    status: {
      remote_enabled: true, agent_connection: 'connected',
      shared_browser: { connected: true },
    },
  };

  it('accepts only an independently verified, live shared-browser connect', () => {
    expect(isVerifiedCinemaConnectResult(connected)).toBe(true);
    expect(isVerifiedCinemaConnectResult({ ...connected, verified_connected: false })).toBe(false);
    expect(isVerifiedCinemaConnectResult({ ...connected, status: { agent_connection: 'connected' } })).toBe(false);
    expect(isVerifiedCinemaConnectResult({ ...connected, status: { ...connected.status, remote_enabled: false } })).toBe(false);
    expect(isVerifiedCinemaConnectResult({ ...connected, status: { ...connected.status, shared_browser: { connected: false } } })).toBe(false);
    expect(isVerifiedCinemaConnectResult({ ...connected, ok: false })).toBe(false);
    expect(isVerifiedCinemaConnectResult(null)).toBe(false);
  });

  it('never extends beyond the bounded session safety window or across reload', () => {
    const now = 1_800_000_000_000;
    expect(mayReuseRecentCinemaConnection(now - 1000, now)).toBe(true);
    expect(mayReuseRecentCinemaConnection(now - (9 * 60_000 - 1), now)).toBe(true);
    expect(mayReuseRecentCinemaConnection(now - 9 * 60_000, now)).toBe(false);
    expect(mayReuseRecentCinemaConnection(0, now)).toBe(false);
    expect(mayReuseRecentCinemaConnection(now + 1, now)).toBe(false);
    expect(mayReuseRecentCinemaConnection(Number.NaN, now)).toBe(false);
  });

  it('keeps exact approval and provider evidence for every browser mutation', () => {
    const source = readFileSync(join(process.cwd(), 'components/dsg-live-workroom.tsx'), 'utf8');
    expect(source).toContain("request.route_id === 'route.cinema-remote.connect'");
    expect(source).toContain('isVerifiedCinemaConnectResult(result)');
    expect(source).toContain('mayReuseRecentCinemaConnection(cinemaConnectedVerifiedAt.current, Date.now())');
    expect(source).toContain("tool('spacetime_request_approval'");
    expect(source).toContain("tool('spacetime_claim_approval'");
    expect(source).toContain("tool('spacetime_execute'");
    expect(source).toContain("tool('spacetime_verify_evidence'");
    expect(source).toContain('workroomReceiptMatches(data.receipt, request, approvalId)');
    expect(source).toContain('!pending.steps.some(step => step.approvalRequestId)');
    expect(source).toContain('window.addEventListener(\'focus\', onReturn)');
    expect(source).not.toContain('localStorage.setItem');
    expect(source).not.toContain('sessionStorage.setItem');
  });
});
