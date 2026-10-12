import { NextResponse } from 'next/server';
import { createAppBuilderFlowProof } from '@/lib/dsg/app-builder/proof/create-flow-proof';
import { emitLifecycleEvent } from '@/lib/dsg/lifecycle/activecampaign';
import { resolveVerifiedDsgUser } from '@/lib/dsg/server/context';

const DEFAULT_GOAL = 'Build a CRM dashboard for small teams with contacts, tasks, notes, and workspace roles.';

export async function GET() {
  const proof = createAppBuilderFlowProof(DEFAULT_GOAL);
  return NextResponse.json(proof);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const goal = typeof body.goal === 'string' && body.goal.trim().length >= 8 ? body.goal : DEFAULT_GOAL;
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const proof = createAppBuilderFlowProof(goal);

    // The proof itself is a public dry-run. Tagging a CRM contact is not: it needs a signed-in user
    // and only ever concerns that user's own address.
    type Lifecycle = { ok: boolean; delivered: boolean; provider: 'activecampaign'; reason?: string };
    let lifecycle: Lifecycle = { ok: true, delivered: false, provider: 'activecampaign', reason: 'EMAIL_NOT_PROVIDED' };
    if (email) {
      const user = await resolveVerifiedDsgUser(req.headers).catch(() => null);
      if (!user) {
        lifecycle = { ok: true, delivered: false, provider: 'activecampaign', reason: 'LOGIN_REQUIRED' };
      } else if (!user.email || user.email !== email.toLowerCase()) {
        lifecycle = { ok: true, delivered: false, provider: 'activecampaign', reason: 'EMAIL_NOT_ACCOUNT_EMAIL' };
      } else {
        const emitted: Lifecycle = await emitLifecycleEvent({
          event: 'proof_created',
          email: user.email,
          data: {
            proof_hash: proof.proofHash,
            proof_kind: proof.proofKind,
            runtime_gate: proof.runtimeGate.status,
            claim_status: proof.claimBoundary.claimStatus,
          },
        });
        lifecycle = emitted.reason === 'CONTACT_NOT_FOUND' ? { ...emitted, reason: 'NOT_DELIVERED' } : emitted;
      }
    }

    return NextResponse.json({ ...proof, lifecycle });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'APP_BUILDER_FLOW_PROOF_FAILED';
    return NextResponse.json(
      {
        ok: false,
        status: 'BLOCK',
        error: { code: message, message },
        claimBoundary: {
          claimStatus: 'APP_BUILDER_FLOW_PROOF_BLOCKED',
          productReadyClaim: false,
          manusLevelClaim: false,
          productionReadyClaim: false,
        },
      },
      { status: 500 },
    );
  }
}
