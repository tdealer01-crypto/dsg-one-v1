import { createHash } from 'node:crypto';

export type DiagnosticToolKind = 'lint' | 'typecheck' | 'test' | 'build' | 'browser' | 'preview' | 'custom';

export type DiagnosticToolObservation = {
  tool: DiagnosticToolKind;
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
};

export type InheritedBlindnessVerdict = {
  ok: boolean;
  status: 'PASS' | 'BLOCKED';
  blockedReasons: string[];
  proofHash: string;
  nextAction: string;
};

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function blank(value: string): boolean {
  return value.trim().length === 0;
}

export function evaluateInheritedBlindnessGate(input: {
  observations: DiagnosticToolObservation[];
  expectedTools: DiagnosticToolKind[];
  repairAttempted?: boolean;
}): InheritedBlindnessVerdict {
  const blockedReasons: string[] = [];
  const seen = new Set(input.observations.map((item) => item.tool));

  for (const tool of input.expectedTools) {
    if (!seen.has(tool)) blockedReasons.push(`DIAGNOSTIC_TOOL_MISSING:${tool}`);
  }

  for (const item of input.observations) {
    if (!item.command.trim()) blockedReasons.push(`COMMAND_EMPTY:${item.tool}`);
    if (typeof item.exitCode !== 'number') blockedReasons.push(`EXIT_CODE_UNKNOWN:${item.tool}`);
    if (item.durationMs <= 0) blockedReasons.push(`DURATION_INVALID:${item.tool}`);
    if (blank(item.stdout) && blank(item.stderr)) blockedReasons.push(`EMPTY_OUTPUT_NOT_PASS:${item.tool}`);
    if (item.exitCode !== 0) blockedReasons.push(`NON_ZERO_EXIT:${item.tool}:${item.exitCode}`);
  }

  if (input.repairAttempted && blockedReasons.some((reason) => reason.startsWith('EMPTY_OUTPUT_NOT_PASS') || reason.startsWith('EXIT_CODE_UNKNOWN'))) {
    blockedReasons.push('REPAIR_LOOP_BLOCKED_BY_UNTRUSTED_DIAGNOSTIC');
  }

  const ok = blockedReasons.length === 0;
  return {
    ok,
    status: ok ? 'PASS' : 'BLOCKED',
    blockedReasons,
    proofHash: hash({ input, blockedReasons, ok }),
    nextAction: ok
      ? 'Diagnostic toolchain is trustworthy for this run.'
      : 'Stop repair. Restore or replace the diagnostic toolchain before making code changes.',
  };
}
