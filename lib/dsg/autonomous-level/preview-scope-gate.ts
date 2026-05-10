import { createHash } from 'node:crypto';

export type PreviewScope = 'frontend_preview_deployment' | 'isolated_preview_environment';

export type PreviewScopeInput = {
  scope: PreviewScope;
  hasFrontendUrl: boolean;
  hasIsolatedBackend: boolean;
  hasIsolatedDatabase: boolean;
  hasIsolatedQueue: boolean;
  hasIsolatedCache: boolean;
  e2eExecuted: boolean;
  routeProofCount: number;
};

export type PreviewScopeGateResult = {
  ok: boolean;
  status: 'PASS' | 'BLOCKED';
  allowedClaim: 'PREVIEW_URL_PROOF_ONLY' | 'ISOLATED_PREVIEW_ENVIRONMENT_PROOF' | 'PREVIEW_PROOF_BLOCKED';
  blockedReasons: string[];
  proofHash: string;
  nextAction: string;
};

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function evaluatePreviewScopeGate(input: PreviewScopeInput): PreviewScopeGateResult {
  const blockedReasons: string[] = [];
  if (!input.hasFrontendUrl) blockedReasons.push('FRONTEND_URL_REQUIRED');
  if (!input.e2eExecuted) blockedReasons.push('E2E_REQUIRED');
  if (input.routeProofCount < 1) blockedReasons.push('ROUTE_PROOF_REQUIRED');

  if (input.scope === 'isolated_preview_environment') {
    if (!input.hasIsolatedBackend) blockedReasons.push('ISOLATED_BACKEND_REQUIRED');
    if (!input.hasIsolatedDatabase) blockedReasons.push('ISOLATED_DATABASE_REQUIRED');
    if (!input.hasIsolatedQueue) blockedReasons.push('ISOLATED_QUEUE_REQUIRED');
    if (!input.hasIsolatedCache) blockedReasons.push('ISOLATED_CACHE_REQUIRED');
  }

  const ok = blockedReasons.length === 0;
  const allowedClaim = !ok
    ? 'PREVIEW_PROOF_BLOCKED'
    : input.scope === 'isolated_preview_environment'
      ? 'ISOLATED_PREVIEW_ENVIRONMENT_PROOF'
      : 'PREVIEW_URL_PROOF_ONLY';

  return {
    ok,
    status: ok ? 'PASS' : 'BLOCKED',
    allowedClaim,
    blockedReasons,
    proofHash: hash({ input, blockedReasons, allowedClaim, ok }),
    nextAction: ok
      ? 'Preview scope can be used with its allowed claim boundary.'
      : 'Collect required URL, E2E, route, and isolation proof before promotion.',
  };
}
