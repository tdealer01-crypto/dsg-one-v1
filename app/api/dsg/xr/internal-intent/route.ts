import { NextResponse } from 'next/server';
import { executeGovernedProposal } from '@/lib/dsg/core-spin/governed-execution';
import {
  normalizeXrReadIntentToCoreSpin,
  type CoreSpinXrIntentEnvelope,
} from '@/lib/dsg/core-spin/xr-intent';
import { toXrExecutionReceipt } from '@/lib/dsg/core-spin/xr-receipt';
import { isDsgInternalControlPlaneAuthorized } from '@/lib/dsg/server/internal-control-plane-auth';

type InternalXrIntentRequest = {
  verified_principal?: string;
  intent?: CoreSpinXrIntentEnvelope;
};

function verifiedOauthPrincipal(value: unknown): string {
  if (typeof value !== 'string') throw new Error('XR_FEDERATED_PRINCIPAL_REQUIRED');
  const principal = value.trim();
  if (
    !principal.startsWith('oauth:')
    || principal.length <= 'oauth:'.length
    || principal.length > 256
    || principal.includes('\0')
  ) {
    throw new Error('XR_FEDERATED_PRINCIPAL_INVALID');
  }
  return principal;
}

export async function POST(request: Request) {
  if (!isDsgInternalControlPlaneAuthorized(
    request.headers.get('x-dsg-internal-key') ?? undefined,
  )) {
    return NextResponse.json(
      { status: 'BLOCK', verdict: 'BLOCK', reason: 'DSG_INTERNAL_AUTH_REQUIRED' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json() as InternalXrIntentRequest;
    const principal = verifiedOauthPrincipal(body.verified_principal);
    if (!body.intent) throw new Error('XR_INTENT_REQUIRED');

    const proposal = normalizeXrReadIntentToCoreSpin(body.intent, {
      ownerId: principal,
      principal,
    });
    const result = await executeGovernedProposal(proposal);

    return NextResponse.json({
      ...toXrExecutionReceipt(proposal, result),
      federation_authority: 'dsg-spacetime-oauth-edge',
      authentication_mode: 'internal-control-plane',
    }, {
      status: result.state === 'FAILED' ? 502 : 200,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'XR_INTERNAL_CORE_SPIN_REJECTED';
    return NextResponse.json(
      { status: 'BLOCK', verdict: 'BLOCK', reason: code },
      { status: 400 },
    );
  }
}
