import { createHash } from 'node:crypto';

export type IndependentVerifierProof = {
  verifierId: string;
  verifierKind: 'ci' | 'external_service' | 'human_review' | 'secondary_toolchain';
  targetRunId: string;
  sourceTool: string;
  independentTool: string;
  verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  evidenceRef: string;
  observedAt: string;
};

export type IndependentVerifierResult = {
  ok: boolean;
  status: 'PASS' | 'PROOF_REQUIRED' | 'BLOCKED';
  missing: string[];
  proofHash: string;
  nextAction: string;
};

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function evaluateIndependentVerifierProof(proof?: Partial<IndependentVerifierProof>): IndependentVerifierResult {
  const missing: string[] = [];
  if (!proof?.verifierId) missing.push('verifierId');
  if (!proof?.verifierKind) missing.push('verifierKind');
  if (!proof?.targetRunId) missing.push('targetRunId');
  if (!proof?.sourceTool) missing.push('sourceTool');
  if (!proof?.independentTool) missing.push('independentTool');
  if (!proof?.evidenceRef) missing.push('evidenceRef');
  if (!proof?.observedAt) missing.push('observedAt');
  if (proof?.sourceTool && proof?.independentTool && proof.sourceTool === proof.independentTool) missing.push('independentTool_must_differ');

  const ok = missing.length === 0 && proof?.verdict === 'PASS';
  return {
    ok,
    status: ok ? 'PASS' : missing.length ? 'PROOF_REQUIRED' : 'BLOCKED',
    missing,
    proofHash: hash({ proof, missing, ok }),
    nextAction: ok
      ? 'Independent verifier can support repair or release promotion.'
      : 'Collect proof from an independent verifier before allowing repair or release promotion.',
  };
}
