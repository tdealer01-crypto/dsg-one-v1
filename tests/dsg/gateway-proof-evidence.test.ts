import assert from 'node:assert/strict';
import { bindGatewayProofEvidence } from '@/lib/dsg/runtime/gateway-proof-evidence';

const bundle = bindGatewayProofEvidence({
  jobId: 'job-1',
  actorId: 'actor-1',
  gatewayProof: {
    decision: 'PASS', violated: [], smt2: '(assert true)', smt2Hash: 'sha256:' + 'a'.repeat(64), resultHash: 'sha256:' + 'b'.repeat(64),
    policyVersion: 'v1', sourceRepo: 'repo', sourceRef: 'ref',
  },
});

assert.equal(bundle.evidence.evidenceType, 'gateway_proof');
assert.ok(bundle.auditEntry.currentHash.startsWith('sha256:'));
assert.ok(bundle.replayHash.startsWith('sha256:'));
