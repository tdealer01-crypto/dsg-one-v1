import { createHash } from 'node:crypto';
import { DSG_PROVIDER_PROOF_SUMMARY, isDsgProviderProofComplete } from './provider-proof-summary';

export type DsgAutonomousCapabilityId =
  | 'auth_rbac'
  | 'deterministic_planner'
  | 'flow_studio'
  | 'sandbox_isolation'
  | 'agent_repair_loop'
  | 'remote_browser_session'
  | 'artifact_timeline'
  | 'preview_deployment_proof'
  | 'production_smoke_proof';

export type DsgAutonomousCapabilityStatus = 'PASS' | 'PARTIAL' | 'BLOCKED';

export type DsgAutonomousCapability = {
  id: DsgAutonomousCapabilityId;
  label: string;
  status: DsgAutonomousCapabilityStatus;
  requiredForComplete: boolean;
  evidence: string[];
  blockedReason?: string;
  nextAction: string;
};

export type DsgAutonomousLevelGate = {
  claim: 'DSG_AUTONOMOUS_LEVEL_BLOCKED' | 'DSG_AUTONOMOUS_LEVEL_PARTIAL' | 'DSG_AUTONOMOUS_LEVEL_COMPLETE';
  complete: boolean;
  score: number;
  passed: number;
  totalRequired: number;
  capabilities: DsgAutonomousCapability[];
  missingRequired: DsgAutonomousCapabilityId[];
  proofHash: string;
};

function stableHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort())).digest('hex');
}

export function evaluateDsgAutonomousLevelGate(input?: Partial<Record<DsgAutonomousCapabilityId, DsgAutonomousCapabilityStatus>>): DsgAutonomousLevelGate {
  const providerProofComplete = isDsgProviderProofComplete();
  const providerProofEvidence = `Provider proof summary: ${DSG_PROVIDER_PROOF_SUMMARY.claim}; proofHash=${DSG_PROVIDER_PROOF_SUMMARY.proofHash}; rawArtifacts=${DSG_PROVIDER_PROOF_SUMMARY.rawArtifactPolicy}`;
  const status = (id: DsgAutonomousCapabilityId, fallback: DsgAutonomousCapabilityStatus) => input?.[id] ?? fallback;
  const providerStatus = (id: DsgAutonomousCapabilityId, fallback: DsgAutonomousCapabilityStatus) =>
    input?.[id] ?? (providerProofComplete ? 'PASS' : fallback);

  const capabilities: DsgAutonomousCapability[] = [
    {
      id: 'auth_rbac',
      label: 'Verified auth and workspace RBAC',
      status: status('auth_rbac', 'PASS'),
      requiredForComplete: true,
      evidence: ['Privileged App Builder and Flow Studio routes reject unauthenticated mutation attempts.'],
      nextAction: 'Keep every privileged runtime route behind verified DSG context.',
    },
    {
      id: 'deterministic_planner',
      label: 'Deterministic planner and claim gate',
      status: status('deterministic_planner', 'PASS'),
      requiredForComplete: true,
      evidence: ['Control kernel smoke', 'deterministic suite smoke', 'Flow Studio smoke'],
      nextAction: 'Keep claim downgrade behavior deterministic and fail-closed.',
    },
    {
      id: 'flow_studio',
      label: 'DSG Flow Studio hardened action planner',
      status: status('flow_studio', 'PASS'),
      requiredForComplete: true,
      evidence: ['Flow Studio production smoke verified', 'mutate route locked', 'MCP route allowlisted'],
      nextAction: 'Connect planner outputs to App Builder timeline and artifact ledger.',
    },
    {
      id: 'sandbox_isolation',
      label: 'Isolated sandbox runner',
      status: providerStatus('sandbox_isolation', 'BLOCKED'),
      requiredForComplete: true,
      evidence: providerProofComplete
        ? ['Sandbox provider proof lane passed.', providerProofEvidence]
        : ['Sandbox contract exists, but no isolated provider proof exists yet.'],
      blockedReason: providerProofComplete ? undefined : 'Need provider-backed isolated execution, command logs, timeout, and artifact storage.',
      nextAction: providerProofComplete ? 'Keep sandbox proof attached to the safe provider proof summary.' : 'Add provider adapter for isolated build/test execution and attach logs as evidence.',
    },
    {
      id: 'agent_repair_loop',
      label: 'Plan-act-observe-repair-verify loop',
      status: providerStatus('agent_repair_loop', 'PARTIAL'),
      requiredForComplete: true,
      evidence: providerProofComplete
        ? ['Bounded repair proof lane passed.', providerProofEvidence]
        : ['Build log analyzer and deterministic workflow exist, but autonomous repair commits are not provider-backed.'],
      blockedReason: providerProofComplete ? undefined : 'Need controlled repair attempts against sandbox failures.',
      nextAction: providerProofComplete ? 'Keep bounded repair proof in the provider proof summary.' : 'Implement bounded repair attempts with diff evidence and stop conditions.',
    },
    {
      id: 'remote_browser_session',
      label: 'Remote browser or computer session',
      status: providerStatus('remote_browser_session', 'BLOCKED'),
      requiredForComplete: true,
      evidence: providerProofComplete
        ? ['Browser proof lane passed by manual-browser-evidence.', providerProofEvidence]
        : ['Flow Studio public-search path is native HTTP evidence, not a remote browser session.'],
      blockedReason: providerProofComplete ? undefined : 'Need actual browser/session provider, screenshots, navigation log, and takeover checkpoint.',
      nextAction: providerProofComplete ? 'Replace manual-browser-evidence with automated browser provider evidence when available.' : 'Add remote browser provider adapter and proof capture.',
    },
    {
      id: 'artifact_timeline',
      label: 'User-visible artifact timeline',
      status: providerStatus('artifact_timeline', 'PARTIAL'),
      requiredForComplete: true,
      evidence: providerProofComplete
        ? ['Artifact timeline proof lane passed.', providerProofEvidence]
        : ['App Builder metadata and proof screens exist, but unified timeline is not complete.'],
      blockedReason: providerProofComplete ? undefined : 'Need generated files, PR links, build logs, browser proof, and deployment proof in one timeline.',
      nextAction: providerProofComplete ? 'Keep timeline event hashes attached to the provider proof summary.' : 'Build a single evidence timeline component backed by deterministic report data.',
    },
    {
      id: 'preview_deployment_proof',
      label: 'Preview deployment proof collector',
      status: providerStatus('preview_deployment_proof', 'BLOCKED'),
      requiredForComplete: true,
      evidence: providerProofComplete
        ? ['Preview deployment proof lane passed.', providerProofEvidence]
        : ['Vercel build status exists, but per-job preview proof collector is not wired.'],
      blockedReason: providerProofComplete ? undefined : 'Need URL health check, response code, screenshot or HTML proof, and stored proof hash per job.',
      nextAction: providerProofComplete ? 'Keep preview route hashes attached to the provider proof summary.' : 'Add preview proof collector and store proof hash before claim promotion.',
    },
    {
      id: 'production_smoke_proof',
      label: 'Production smoke proof',
      status: status('production_smoke_proof', 'PASS'),
      requiredForComplete: true,
      evidence: ['Production smoke verified for App Builder and Flow Studio routes.'],
      nextAction: 'Keep production smoke tests explicit and repeatable.',
    },
  ];

  const required = capabilities.filter((capability) => capability.requiredForComplete);
  const passed = required.filter((capability) => capability.status === 'PASS').length;
  const missingRequired = required.filter((capability) => capability.status !== 'PASS').map((capability) => capability.id);
  const score = Number((passed / required.length).toFixed(4));
  const claim = missingRequired.length === 0 ? 'DSG_AUTONOMOUS_LEVEL_COMPLETE' : passed > 0 ? 'DSG_AUTONOMOUS_LEVEL_PARTIAL' : 'DSG_AUTONOMOUS_LEVEL_BLOCKED';
  const proofBasis = { claim, passed, totalRequired: required.length, missingRequired, capabilities, providerProofSummary: DSG_PROVIDER_PROOF_SUMMARY };

  return {
    claim,
    complete: claim === 'DSG_AUTONOMOUS_LEVEL_COMPLETE',
    score,
    passed,
    totalRequired: required.length,
    capabilities,
    missingRequired,
    proofHash: stableHash(proofBasis),
  };
}
