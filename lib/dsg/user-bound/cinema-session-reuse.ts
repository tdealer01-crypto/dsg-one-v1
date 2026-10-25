import { asRecord } from './workroom-contract';

// Verified connect receipts include an independent remote_status readback.
// A successful HTTP response or 'connected' flag alone does not establish
// a usable same-account browser; fail closed on missing/partial status.
export function isVerifiedCinemaConnectResult(value: unknown): boolean {
  const result = asRecord(value);
  const status = asRecord(result?.status);
  const shared = asRecord(status?.shared_browser);
  return result?.ok === true && result?.verified_connected === true &&
    status?.remote_enabled === true &&
    status?.agent_connection === 'connected' && shared?.connected === true;
}

// A verified connect is bound to one in-memory Workroom instance, not a
// reusable plan-wide permission. Keep a safety margin below the 600s TTL.
// The next execute still needs its own exact signed approval and backend gate.
export function mayReuseRecentCinemaConnection(verifiedAtMs: number, nowMs: number): boolean {
  return Number.isFinite(verifiedAtMs) && verifiedAtMs > 0 && Number.isFinite(nowMs) &&
    nowMs >= verifiedAtMs && nowMs - verifiedAtMs < 9 * 60 * 1000;
}
