// A process_start acknowledgement is not necessarily a successful command.
// A shell job completes successfully only with an observed exit code 0.
import { asRecord } from './workroom-contract';

export type ShellOutcome = {
  state: 'running' | 'succeeded' | 'failed' | 'unknown';
  processId: string | null;
  exitCode: number | null;
};
export function nativeShellOutcome(result: unknown, expectedProcessId?: string): ShellOutcome {
  const outer = asRecord(result);
  const operation = asRecord(asRecord(outer?.execution)?.result);
  if (!operation || operation.ok !== true) return { state: 'unknown', processId: null, exitCode: null };
  const record = expectedProcessId && Array.isArray(operation.processes)
    ? operation.processes.map(asRecord).find(item => item?.process_id === expectedProcessId)
    : operation;
  const row = asRecord(record);
  if (!row || typeof row.process_id !== 'string' ||
      (expectedProcessId && row.process_id !== expectedProcessId))
    return { state: 'unknown', processId: null, exitCode: null };
  if (row.running === true) return { state: 'running', processId: row.process_id, exitCode: null };
  if (row.running === false && typeof row.returncode === 'number' && Number.isInteger(row.returncode))
    return {
      state: row.returncode === 0 ? 'succeeded' : 'failed',
      processId: row.process_id,
      exitCode: row.returncode,
    };
  return { state: 'unknown', processId: row.process_id, exitCode: null };
}
