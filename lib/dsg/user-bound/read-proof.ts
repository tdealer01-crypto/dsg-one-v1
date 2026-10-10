// Authoritative client-side acceptance predicate for the fixed AWS OAuth
// provider-read receipt. A global chain-valid flag alone is NOT proof of the
// specific read operation. Keep synthetic fixtures out of production status.
export type GovernedReadProof = {
  plan_hash: string;
  route_id: string;
  decision: 'ALLOW';
  evidence_hash: string;
  evidence_chain_valid: true;
  auth0_principal: 'VERIFIED_USER_SUBJECT';
};
const HASH = /^[0-9a-f]{64}$/;
const FIXED_ROUTE = 'route.github-public.repo-metadata-read';
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
function validHash(value: unknown): value is string {
  return typeof value === 'string' && HASH.test(value);
}

export function verifiedGovernedReadProof(read: unknown, chain: unknown): GovernedReadProof | null {
  const readResponse = record(read);
  const chainResponse = record(chain);
  const receipt = record(readResponse?.receipt);
  const evidence = record(receipt?.evidence);
  const providerResult = record(receipt?.result);
  const decision = record(receipt?.decision);
  const chainReceipt = record(chainResponse?.receipt);
  if (!readResponse || readResponse.ok !== true || readResponse.userPrincipalVerified !== true ||
      !chainResponse || chainResponse.ok !== true || chainResponse.userPrincipalVerified !== true ||
      chainResponse.evidenceVerified !== true || chainReceipt?.valid !== true ||
      decision?.verdict !== 'ALLOW' ||
      receipt?.principal_binding !== 'VERIFIED_OAUTH_SUBJECT' ||
      !validHash(receipt.plan_hash) ||
      receipt.route_id !== FIXED_ROUTE ||
      !evidence || evidence.route_id !== FIXED_ROUTE ||
      evidence.agent_id !== 'dsg-chatgpt-public-read' ||
      typeof evidence.plan_id !== 'string' || !evidence.plan_id.startsWith('chatgpt-public-read-') ||
      !Number.isSafeInteger(evidence.index) || Number(evidence.index) < 0 ||
      !validHash(evidence.evidence_hash) ||
      !validHash(evidence.request_hash) || !validHash(evidence.result_hash) ||
      !validHash(evidence.decision_hash) ||
      !providerResult || Object.keys(providerResult).length === 0) {
    return null;
  }
  return {
    plan_hash: receipt.plan_hash,
    route_id: FIXED_ROUTE,
    decision: 'ALLOW',
    evidence_hash: evidence.evidence_hash,
    evidence_chain_valid: true,
    auth0_principal: 'VERIFIED_USER_SUBJECT',
  };
}
