import { describe, expect, it } from 'vitest';
import {
  createAimoShardPlan,
  materializeCandidate,
} from '../../lib/dsg/aimo/deterministic';
import { runAimoHarness } from '../../lib/dsg/aimo/harness';
import type { SolveSimulationShardInput } from '../../lib/dsg/aimo/simulation-client';
import type {
  AimoCandidate,
  AimoShardResult,
  AimoVerificationResult,
} from '../../lib/dsg/aimo/types';

const problem = {
  problemId: 'hidden-1',
  statement: 'Find an integer x such that x + 1 = 3.',
  domain: 'algebra',
};

function passVerification(candidate: AimoCandidate): AimoVerificationResult {
  return {
    verdict: candidate.answer === '2' ? 'PASS' : 'BLOCKED',
    verifier: 'test-exact-checker',
    reason: candidate.answer === '2' ? 'exact equality' : 'wrong answer',
    proofHash: `proof:${candidate.candidateHash}`,
  };
}

describe('DSG AIMO deterministic core', () => {
  it('creates identical shard ids and seeds for identical input', () => {
    const a = createAimoShardPlan(problem, 8);
    const b = createAimoShardPlan(problem, 8);
    expect(a).toEqual(b);
    expect(new Set(a.map((item) => item.seed)).size).toBe(8);
    expect(a.every((item) => item.shardCount === 8)).toBe(true);
  });

  it('selects the same result with parallelism 1 and 4', async () => {
    const solveShard = async ({
      shard,
    }: SolveSimulationShardInput): Promise<AimoShardResult> => {
      const answer = shard.index === 3 ? '2' : String(shard.index + 10);
      return {
        shard,
        ok: true,
        searchComplete: true,
        candidates: [
          materializeCandidate(
            {
              answer,
              proof: `candidate from ${shard.shardId}`,
              verification: {
                kind: 'z3-witness',
                endpoint: '/v1/verify',
                payload: { shard: shard.shardId, answer },
              },
            },
            shard,
          ),
        ],
        replayHash: `replay:${shard.seed}`,
      };
    };

    const dependencies = {
      getStrategy: async () => undefined,
      solveShard,
      verifyCandidate: async (candidate: AimoCandidate) =>
        passVerification(candidate),
    };

    const serial = await runAimoHarness(
      { problem, shardCount: 8, parallelism: 1 },
      dependencies,
    );
    const parallel = await runAimoHarness(
      { problem, shardCount: 8, parallelism: 4 },
      dependencies,
    );

    expect(serial.selectedCandidate?.candidateHash).toBe(
      parallel.selectedCandidate?.candidateHash,
    );
    expect(serial.receiptHash).toBe(parallel.receiptHash);
    expect(serial.verdict).toBe('PASS');
    expect(serial.runDeterminism).toBe('FULL');
  });

  it('fails closed when no candidate has a structured PASS', async () => {
    const result = await runAimoHarness(
      { problem, shardCount: 2, parallelism: 2 },
      {
        getStrategy: async () => undefined,
        solveShard: async ({ shard }) => ({
          shard,
          ok: true,
          searchComplete: true,
          candidates: [
            materializeCandidate({ answer: 'wrong' }, shard),
          ],
        }),
        verifyCandidate: async () => ({
          verdict: 'BLOCKED',
          verifier: 'test',
          reason: 'not proved',
        }),
      },
    );

    expect(result.verdict).toBe('BLOCKED');
    expect(result.selectedCandidate).toBeUndefined();
  });

  it('does not call partial shard search COMPLETE, but accepts an independent global-optimum certificate', async () => {
    const result = await runAimoHarness(
      { problem, shardCount: 2, parallelism: 2 },
      {
        getStrategy: async () => undefined,
        solveShard: async ({ shard }) => ({
          shard,
          ok: true,
          searchComplete: false,
          candidates: [
            materializeCandidate(
              {
                answer: '2',
                verification: {
                  kind: 'proof-certificate',
                  endpoint: '/v1/math/aimo/exact-energy-witness',
                  payload: {},
                },
              },
              shard,
            ),
          ],
        }),
        verifyCandidate: async () => ({
          verdict: 'PASS',
          verifier: 'Cinema',
          reason: 'Z3 proved no lower-energy assignment exists',
          certificateLevel: 'VERIFIED_GLOBAL_OPTIMUM',
        }),
      },
    );

    expect(result.searchCoverage).toBe('PARTIAL');
    expect(result.shardCompleteCount).toBe(0);
    expect(result.verdict).toBe('PASS');
  });

  it('marks a live NVIDIA strategy run CORE_ONLY', async () => {
    const result = await runAimoHarness(
      { problem, shardCount: 1, parallelism: 1 },
      {
        getStrategy: async () => ({
          provider: 'nvidia-ising',
          model: 'nvidia/ising-calibration-1.5-31b',
          text: 'strategy',
          responseHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          mode: 'live',
          determinism: 'EXTERNAL_PROVIDER_NOT_GUARANTEED',
        }),
        solveShard: async ({ shard }) => ({
          shard,
          ok: true,
          searchComplete: true,
          candidates: [],
        }),
        verifyCandidate: async () => ({
          verdict: 'BLOCKED',
          verifier: 'none',
          reason: 'none',
        }),
      },
    );

    expect(result.runDeterminism).toBe('CORE_ONLY');
    expect(result.externalProviderDeterminism).toBe('NOT_GUARANTEED');
  });

  it('marks a pinned NVIDIA strategy run FULL', async () => {
    const result = await runAimoHarness(
      { problem, shardCount: 1, parallelism: 1 },
      {
        getStrategy: async () => ({
          provider: 'nvidia-ising',
          model: 'nvidia/ising-calibration-1.5-31b',
          text: 'pinned strategy',
          responseHash: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          mode: 'pinned',
          determinism: 'PINNED_REPLAY',
        }),
        solveShard: async ({ shard }) => ({
          shard,
          ok: true,
          searchComplete: true,
          candidates: [],
        }),
        verifyCandidate: async () => ({
          verdict: 'BLOCKED',
          verifier: 'none',
          reason: 'none',
        }),
      },
    );

    expect(result.runDeterminism).toBe('FULL');
    expect(result.externalProviderDeterminism).toBe('PINNED');
  });

  it('excludes history-dependent audit response hashes from deterministic receiptHash', async () => {
    let evidenceCounter = 0;
    const solveShard = async ({ shard }: SolveSimulationShardInput): Promise<AimoShardResult> => ({
      shard,
      ok: true,
      status: 'PASS',
      searchComplete: true,
      searchedAssignments: 2,
      candidates: [
        materializeCandidate(
          {
            answer: '2',
            proof: 'stable proof',
            verification: {
              kind: 'proof-certificate',
              endpoint: '/v1/math/aimo/exact-energy-witness',
              payload: { answer: 2 },
            },
          },
          shard,
        ),
      ],
    });

    const dependencies = {
      getStrategy: async () => undefined,
      solveShard,
      verifyCandidate: async (): Promise<AimoVerificationResult> => ({
        verdict: 'PASS',
        verifier: 'DSG Cinema Proof Agent',
        reason: 'globally optimal',
        proofHash: 'sha256:stable-proof',
        certificateLevel: 'VERIFIED_GLOBAL_OPTIMUM',
        evidenceHash: `sha256:audit-event-${++evidenceCounter}`,
      }),
    };

    const first = await runAimoHarness(
      { problem, shardCount: 2, parallelism: 1 },
      dependencies,
    );
    const second = await runAimoHarness(
      { problem, shardCount: 2, parallelism: 2 },
      dependencies,
    );

    expect(first.selectedVerification?.evidenceHash).not.toBe(
      second.selectedVerification?.evidenceHash,
    );
    expect(first.receiptHash).toBe(second.receiptHash);
  });

});
