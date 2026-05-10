import { evaluateArtifactTimelineProof, type ArtifactTimelineProof } from './artifact-timeline-contract';
import { evaluateBrowserSessionProof, type BrowserSessionProof } from './browser-session-contract';
import { evaluatePreviewDeploymentProof, type PreviewDeploymentProof } from './preview-proof-contract';
import { evaluateRepairLoopProof, type RepairLoopProof } from './repair-loop-contract';
import { evaluateSandboxIsolationProof, type SandboxIsolationProof } from './sandbox-isolation-contract';

export type DsgProviderProofBundle = {
  sandbox?: Partial<SandboxIsolationProof>;
  repair?: Partial<RepairLoopProof>;
  browser?: Partial<BrowserSessionProof>;
  timeline?: Partial<ArtifactTimelineProof>;
  preview?: Partial<PreviewDeploymentProof>;
};

export function evaluateDsgProviderProofBundle(bundle: DsgProviderProofBundle = {}) {
  const lanes = {
    sandbox: evaluateSandboxIsolationProof(bundle.sandbox),
    repair: evaluateRepairLoopProof(bundle.repair),
    browser: evaluateBrowserSessionProof(bundle.browser),
    timeline: evaluateArtifactTimelineProof(bundle.timeline),
    preview: evaluatePreviewDeploymentProof(bundle.preview),
  };
  const entries = Object.entries(lanes);
  const passed = entries.filter(([, result]) => result.ok).map(([id]) => id);
  const missing = entries.filter(([, result]) => !result.ok).map(([id, result]) => ({ id, missing: result.missing, nextAction: result.nextAction }));

  return {
    ok: missing.length === 0,
    claim: missing.length === 0 ? 'DSG_PROVIDER_PROOF_COMPLETE' : 'DSG_PROVIDER_PROOF_REQUIRED',
    passed,
    missing,
    lanes,
  };
}
