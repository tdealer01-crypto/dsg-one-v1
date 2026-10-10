import { describe, expect, it } from 'vitest';
import { verifiedGovernedReadProof } from '@/lib/dsg/user-bound/read-proof';

const hash = 'a'.repeat(64);
function fixture() {
  return {
    read: {
      ok: true, userPrincipalVerified: true,
      receipt: {
        plan_hash: hash, route_id: 'route.github-public.repo-metadata-read',
        principal_binding: 'VERIFIED_OAUTH_SUBJECT',
        decision: { verdict: 'ALLOW' },
        result: { full_name: 'public/repository' },
        evidence: {
          plan_id: 'chatgpt-public-read-test', route_id: 'route.github-public.repo-metadata-read',
          agent_id: 'dsg-chatgpt-public-read', index: 24,
          evidence_hash: hash, result_hash: hash, request_hash: hash, decision_hash: hash,
        },
      },
    },
    chain: { ok: true, userPrincipalVerified: true, evidenceVerified: true, receipt: { valid: true, records: 25 } },
  };
}

describe('bound governed public repo read proof', () => {
  it('accepts only an exact live-shaped provider and chain receipt', () => {
    const { read, chain } = fixture();
    expect(verifiedGovernedReadProof(read, chain)).toEqual({
      plan_hash: hash, route_id: 'route.github-public.repo-metadata-read',
      decision: 'ALLOW', evidence_hash: hash, evidence_chain_valid: true,
      auth0_principal: 'VERIFIED_USER_SUBJECT',
    });
  });
  it('does not treat global evidence chain integrity as proof of a specific read', () => {
    const { read, chain } = fixture();
    read.receipt.evidence.evidence_hash = '';
    expect(verifiedGovernedReadProof(read, chain)).toBeNull();
  });
  it('rejects empty provider data and mismatched receipt route or agent', () => {
    const { read, chain } = fixture();
    read.receipt.result = {} as typeof read.receipt.result;
    expect(verifiedGovernedReadProof(read, chain)).toBeNull();
    read.receipt.result = { full_name: 'public/repository' };
    read.receipt.evidence.route_id = 'route.attacker';
    expect(verifiedGovernedReadProof(read, chain)).toBeNull();
    read.receipt.evidence.route_id = 'route.github-public.repo-metadata-read';
    read.receipt.evidence.agent_id = 'attacker-agent';
    expect(verifiedGovernedReadProof(read, chain)).toBeNull();
  });
  it('rejects empty plan hash and evidence decision hash despite ALLOW', () => {
    const { read, chain } = fixture();
    read.receipt.plan_hash = '';
    expect(verifiedGovernedReadProof(read, chain)).toBeNull();
    read.receipt.plan_hash = hash;
    read.receipt.evidence.decision_hash = 'invalid';
    expect(verifiedGovernedReadProof(read, chain)).toBeNull();
  });
  it('rejects chain invalidity and runtime errors', () => {
    const { read, chain } = fixture();
    chain.receipt.valid = false;
    expect(verifiedGovernedReadProof(read, chain)).toBeNull();
    chain.receipt.valid = true;
    read.receipt.decision.verdict = 'BLOCK';
    expect(verifiedGovernedReadProof(read, chain)).toBeNull();
  });
});
