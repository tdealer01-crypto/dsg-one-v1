import { describe, expect, it } from 'vitest';
import { runAimoHarness } from '../../lib/dsg/aimo/harness';

const enabled = process.env.DSG_LIVE_E2E === '1';

describe.runIf(enabled)('LIVE AIMO encoding-proof authority chain', () => {
  it('proves Control Plane -> Simulation -> Cinema on live services', async () => {
    const receipt = await runAimoHarness({
      problem: {
        problemId: 'dsg-live-authority-proof-v1',
        statement: 'Find the exact minimum of the supplied two-variable QUBO encoding.',
        domain: 'live-e2e-proof',
        constraints: {
          aimoEncoding: {
            kind: 'qubo-v1',
            variableCount: 2,
            linear: [
              { i: 0, weight: -3 },
              { i: 1, weight: -2 },
            ],
            quadratic: [{ i: 0, j: 1, weight: 4 }],
            objective: 'min',
          },
        },
      },
      shardCount: 1,
      parallelism: 1,
      maxCandidatesPerShard: 2,
      nvidiaIsing: { mode: 'off' },
      requireAllShards: true,
    });

    const selected = receipt.selectedCandidate;
    const metadata = selected?.metadata ?? {};
    const verification = receipt.selectedVerification;

    const proof = {
      verdict: receipt.verdict,
      searchCoverage: receipt.searchCoverage,
      shardSuccessCount: receipt.shardSuccessCount,
      shardCompleteCount: receipt.shardCompleteCount,
      candidateCount: receipt.candidateCount,
      receiptHash: receipt.receiptHash,
      candidateHash: selected?.candidateHash ?? null,
      encodingProofId:
        typeof metadata.encodingProofId === 'string' ? metadata.encodingProofId : null,
      encodingProofHash:
        typeof metadata.encodingProofHash === 'string' ? metadata.encodingProofHash : null,
      encodingProofAuthority:
        typeof metadata.encodingProofAuthority === 'string'
          ? metadata.encodingProofAuthority
          : null,
      verifierVerdict: verification?.verdict ?? null,
      verifier: verification?.verifier ?? null,
      verifierProofHash: verification?.proofHash ?? null,
      certificateLevel: verification?.certificateLevel ?? null,
    };

    // Safe evidence only: hashes/statuses. No URLs, API keys or raw secrets.
    console.log(`LIVE_AIMO_AUTHORITY_PROOF=${JSON.stringify(proof)}`);

    expect(receipt.verdict).toBe('PASS');
    expect(receipt.searchCoverage).toBe('COMPLETE');
    expect(receipt.shardSuccessCount).toBe(1);
    expect(receipt.shardCompleteCount).toBe(1);
    expect(receipt.candidateCount).toBeGreaterThan(0);
    expect(selected).toBeDefined();
    expect(metadata.encodingProofAuthority).toBe('DSG_CONTROL_PLANE');
    expect(metadata.encodingProofId).toMatch(/^epf_[0-9a-f]{32}$/);
    expect(metadata.encodingProofHash).toMatch(/^[0-9a-f]{64}$/);
    expect(verification?.verdict).toBe('PASS');
    expect(verification?.proofHash).toBeTruthy();
  }, 180_000);
});
