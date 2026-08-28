import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  controlPlaneEncodingHash,
  encodingProofProblemId,
  requestEncodingProofForShard,
  toControlPlaneEncoding,
  type ControlPlaneEncoding,
} from '../../lib/dsg/runtime/encoding-proof-client';
import type { AimoProblemInput } from '../../lib/dsg/aimo/types';

const PROOF_ID = `epf_${'a'.repeat(32)}`;
const PROOF_HASH = 'b'.repeat(64);

const problem: AimoProblemInput = {
  problemId: 'proof-client-qubo-001',
  statement: 'Encoding proof client QUBO',
  constraints: {
    aimoEncoding: {
      kind: 'qubo-v1',
      variableCount: 2,
      linear: [
        { i: 0, weight: -3 },
        { i: 1, weight: -2 },
      ],
      quadratic: [{ i: 0, j: 1, weight: 4 }],
    },
  },
};

const config = {
  controlPlaneUrl: 'https://control-plane.example.test',
  apiKey: 'persisted-dsg-api-key',
  timeoutMs: 1_000,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('AIMO encoding proof client', () => {
  it('converts simulation linear i fields to the Control Plane index schema', () => {
    const converted = toControlPlaneEncoding({
      kind: 'qubo-v1',
      variableCount: 2,
      linear: [{ i: 1, weight: '2' }],
      quadratic: [{ i: 0, j: 1, weight: '3' }],
    });

    expect(converted).toEqual({
      kind: 'qubo-v1',
      variableCount: 2,
      linear: [{ index: 1, weight: '2' }],
      quadratic: [{ i: 0, j: 1, weight: '3' }],
    });
    expect(JSON.stringify(converted)).not.toContain('"i":1,"weight":"2"');
  });

  it('issues request-bound proofs without a client cache and preserves deterministic replay identity', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const requestBodies: Array<Record<string, unknown>> = [];

    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe('https://control-plane.example.test/api/dsg/v1/encoding/prove');
      const headers = new Headers(init?.headers);
      expect(headers.get('authorization')).toBe('Bearer persisted-dsg-api-key');
      const body = JSON.parse(String(init?.body)) as {
        problemId: string;
        encodingType: 'qubo-v1' | 'ising-v1';
        encoding: ControlPlaneEncoding;
        nonce: string;
        idempotencyKey: string;
      };
      requestBodies.push(body as unknown as Record<string, unknown>);
      const encodingHash = controlPlaneEncodingHash(body.encoding);
      return new Response(
        JSON.stringify({
          ok: true,
          status: 'PASS',
          proofId: PROOF_ID,
          proof: {
            proofId: PROOF_ID,
            proofHash: PROOF_HASH,
            encodingHash,
            status: 'PASS',
            subject: {
              problemId: body.problemId,
              encodingType: body.encodingType,
            },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const first = await requestEncodingProofForShard({
      problem,
      problemHash: `sha256:${'c'.repeat(64)}`,
      shardId: 'shard-0000-test',
      config,
    });
    const second = await requestEncodingProofForShard({
      problem,
      problemHash: `sha256:${'c'.repeat(64)}`,
      shardId: 'shard-0000-test',
      config,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(first).toEqual(second);
    expect(first.proofId).toBe(PROOF_ID);
    expect(first.proofHash).toBe(PROOF_HASH);
    expect(requestBodies[0]?.nonce).toBe(requestBodies[1]?.nonce);
    expect(requestBodies[0]?.idempotencyKey).toBe(requestBodies[1]?.idempotencyKey);
    expect(requestBodies[0]?.encoding).toMatchObject({
      linear: [
        { index: 0, weight: -3 },
        { index: 1, weight: -2 },
      ],
    });
  });

  it('fails closed if Control Plane returns a proof for another encoding', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as {
          problemId: string;
          encodingType: 'qubo-v1' | 'ising-v1';
        };
        return new Response(
          JSON.stringify({
            ok: true,
            status: 'PASS',
            proofId: PROOF_ID,
            proof: {
              proofId: PROOF_ID,
              proofHash: PROOF_HASH,
              encodingHash: 'd'.repeat(64),
              status: 'PASS',
              subject: {
                problemId: body.problemId,
                encodingType: body.encodingType,
              },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }),
    );

    await expect(
      requestEncodingProofForShard({
        problem,
        problemHash: `sha256:${'e'.repeat(64)}`,
        shardId: 'shard-0000-test',
        config,
      }),
    ).rejects.toThrow('does not match submitted encoding');
  });

  it('derives the same fallback problem id contract as the simulation service', () => {
    expect(
      encodingProofProblemId(
        { statement: 'No explicit id' },
        `sha256:${'f'.repeat(64)}`,
      ),
    ).toBe(`aimo-${'f'.repeat(64)}`);
  });
});
