import type { ArtifactTimelineProof } from './artifact-timeline-contract';
import type { BrowserSessionProof } from './browser-session-contract';
import type { PreviewDeploymentProof } from './preview-proof-contract';
import type { RepairLoopProof } from './repair-loop-contract';
import type { SandboxIsolationProof } from './sandbox-isolation-contract';

export type DsgAutonomousProviderId = 'sandbox' | 'repair' | 'browser' | 'timeline' | 'preview';
export type DsgAutonomousProviderState = 'ready' | 'missing';

export type DsgAutonomousProviderStatus = {
  id: DsgAutonomousProviderId;
  state: DsgAutonomousProviderState;
  requiredEnv: string[];
  message: string;
};

export type DsgSandboxProvider = {
  id: 'sandbox';
  run(input: { jobId: string; command: string; timeoutMs: number }): Promise<SandboxIsolationProof>;
};

export type DsgRepairProvider = {
  id: 'repair';
  run(input: { jobId: string; failedCommand: string; maxAttempts: number }): Promise<RepairLoopProof>;
};

export type DsgBrowserProvider = {
  id: 'browser';
  run(input: { jobId: string; startUrl: string }): Promise<BrowserSessionProof>;
};

export type DsgTimelineProvider = {
  id: 'timeline';
  run(input: { jobId: string; proofRefs: string[] }): Promise<ArtifactTimelineProof>;
};

export type DsgPreviewProvider = {
  id: 'preview';
  run(input: { jobId: string; deploymentUrl: string; routes: string[] }): Promise<PreviewDeploymentProof>;
};

export type DsgAutonomousProviderBundle = {
  sandbox?: DsgSandboxProvider;
  repair?: DsgRepairProvider;
  browser?: DsgBrowserProvider;
  timeline?: DsgTimelineProvider;
  preview?: DsgPreviewProvider;
};

const providerEnv: Record<DsgAutonomousProviderId, string[]> = {
  sandbox: ['DSG_SANDBOX_PROVIDER_URL', 'DSG_SANDBOX_PROVIDER_TOKEN'],
  repair: ['DSG_REPAIR_LOOP_ENABLED'],
  browser: ['DSG_BROWSER_PROVIDER_URL', 'DSG_BROWSER_PROVIDER_TOKEN'],
  timeline: ['DSG_TIMELINE_STORE_ENABLED'],
  preview: ['DSG_PREVIEW_PROOF_ENABLED'],
};

function envReady(keys: string[]): boolean {
  return keys.every((key) => Boolean(process.env[key]));
}

export function getDsgAutonomousProviderStatus(): DsgAutonomousProviderStatus[] {
  return (Object.keys(providerEnv) as DsgAutonomousProviderId[]).map((id) => {
    const requiredEnv = providerEnv[id];
    const ready = envReady(requiredEnv);
    return {
      id,
      state: ready ? 'ready' : 'missing',
      requiredEnv,
      message: ready ? 'Provider environment is configured; runtime proof is still required.' : 'Provider environment is missing; this lane must remain fail-closed.',
    };
  });
}

export function assertDsgProviderReady(id: DsgAutonomousProviderId): DsgAutonomousProviderStatus {
  const status = getDsgAutonomousProviderStatus().find((item) => item.id === id);
  if (!status) throw new Error(`DSG_PROVIDER_UNKNOWN:${id}`);
  if (status.state !== 'ready') throw new Error(`DSG_PROVIDER_NOT_READY:${id}`);
  return status;
}
