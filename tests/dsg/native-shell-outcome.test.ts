import { describe, expect, it } from 'vitest';
import { nativeShellOutcome } from '@/lib/dsg/user-bound/native-shell-outcome';
const receipt = (result: unknown) => ({ ok: true, execution: { result } });
describe('governed Native Shell process outcome', () => {
  it('never claims completion just because process_start returned ok=true', () => {
    expect(nativeShellOutcome(receipt({ ok: true, process_id: 'p1', running: true }))).toMatchObject({ state: 'running', exitCode: null });
  });
  it('requires real exit code zero to claim success', () => {
    expect(nativeShellOutcome(receipt({ ok: true, process_id: 'p1', running: false, returncode: 0 }))).toMatchObject({ state: 'succeeded', exitCode: 0 });
  });
  it('labels nonzero exit as failure', () => {
    expect(nativeShellOutcome(receipt({ ok: true, process_id: 'p1', running: false, returncode: 1 }))).toMatchObject({ state: 'failed', exitCode: 1 });
  });
  it('does not treat missing exit code or identity as success', () => {
    expect(nativeShellOutcome(receipt({ ok: true, process_id: 'p1', running: false }))).toMatchObject({ state: 'unknown' });
    expect(nativeShellOutcome(receipt({ ok: true, running: false, returncode: 0 }))).toMatchObject({ state: 'unknown' });
    expect(nativeShellOutcome(receipt({ ok: false, process_id: 'p1', running: false, returncode: 0 }))).toMatchObject({ state: 'unknown' });
  });
  it('selects only the exact process ID from governed read-only list', () => {
    const processes = receipt({ ok: true, processes: [
      { ok: true, process_id: 'p-other', running: false, returncode: 0 },
      { ok: true, process_id: 'p-target', running: true, returncode: null },
    ] });
    expect(nativeShellOutcome(processes, 'p-target')).toMatchObject({ state: 'running', processId: 'p-target' });
    expect(nativeShellOutcome(processes, 'missing')).toMatchObject({ state: 'unknown', processId: null });
  });
});
