import { afterEach, describe, expect, it, vi } from 'vitest';
import { solveSimulationShard } from '../../lib/dsg/aimo/simulation-client';
import { controlPlaneEncodingHash, type ControlPlaneEncoding } from '../../lib/dsg/runtime/encoding-proof-client';
import type { AimoProblemInput, AimoShard } from '../../lib/dsg/aimo/types';

const PROOF_ID = `epf_${'a'.repeat(32)}`;
const PROOF_HASH = 'b'.repeat(64);

const problem: AimoProblemInput = {
  problemId: 'simulation-chain-001',
  statement: 'Exact QUBO simulation chain test',
  constraints: {
    aimoEncoding: {
      kind: 'qubo-v1',
      variableCount: 2,
      linear: [{ i: 0, weight: -1 }],
      quadratic: [{ i: 0, j: 1, weight: 2 }],
    },
  },
};

const shard: AimoShard = {
  index: 0,
  shardCount: 1,
  shardId: 'shard-0000-proof-chain',
  seed: 'seed-proof-chain',
  problemHash: `sha256:${'c'.repeat(64)}`,
};

function configureEnv(): void {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv(
    'DSG_AIMO_SERVICE_REGISTRY',
    JSON.stringify({
      simulationUrl: 'https://simulation.example.test',
      cinemaUrl: 'https://cinema.example.test',
      controlPlaneUrl: 'https://control-plane.example.test',
      maxParallelism: 1,
    }),
  );
  vi.stubEnv('DSG_AIMO_ROOT_KEY', 'root-secret-for-test');
  vi.stubEnv('DSG_CONTROL_PLANE_API_KEY', 'persisted-dsg-api-key');
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('AIMO proof chain across Control Plane -> simulation', () => {
  it('issues proof first, sends its id to simulation, and preserves the returned binding', async () => {
    configureEnv();
    const callOrder: string[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/dsg/v1/encoding/prove')) {
          callOrder.push('control-plane');
          const body = JSON.parse(String(init?.body)) as {
            problemId: string;
            encodingType: 'qubo-v1' | 'ising-v1';
            encoding: ControlPlaneEncoding;
          };
          expect(new Headers(init?.headers).get('authorization')).toBe(
            'Bearer persisted-dsg-api-key',
          );
          return new Response(
            JSON.stringify({
              ok: true,
              status: 'PASS',
              proofId: PROOF_ID,
              proof: {
                proofId: PROOF_ID,
                proofHash: PROOF_HASH,
                encodingHash: controlPlaneEncodingHash(body.encoding),
                status: 'PASS',
                subject: {
                  problemId: body.problemId,
                  encodingType: body.encodingType,
                },
              },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }

        if (url.endsWith('/v1/aimo/solve-shard')) {
          callOrder.push('simulation');
          const body = JSON.parse(String(init?.body)) as {
            encodingProofId?: string;
          };
          expect(body.encodingProofId).toBe(PROOF_ID);
          return new Response(
            JSON.stringify({
              ok: true,
              status: 'PASS',
              searchComplete: true,
              searchedAssignments: 4,
              encodingHash: `sha256:${'d'.repeat(64)}`,
              encodingProofId: PROOF_ID,
              encodingProofHash: PROOF_HASH,
              encodingProofAuthority: 'DSG_CONTROL_PLANE',
              candidates: [
                {
                  answer: '{"bits":[1,0],"energy":"-1"}',
                  proof: 'exact finite witness',
                  metadata: {
                    encodingProofId: PROOF_ID,
                    encodingProofHash: PROOF_HASH,
                    encodingProofAuthority: 'DSG_CONTROL_PLANE',
                  },
                },
              ],
              replayHash: `sha256:${'e'.repeat(64)}`,
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }

        throw new Error(`unexpected fetch URL ${url}`);
      }),
    );

    const result = await solveSimulationShard({
      problem,
      shard,
      maxCandidates: 1,
    });

    expect(callOrder).toEqual(['control-plane', 'simulation']);
    expect(result.ok).toBe(true);
    expect(result.encodingProofId).toBe(PROOF_ID);
    expect(result.encodingProofHash).toBe(PROOF_HASH);
    expect(result.encodingProofAuthority).toBe('DSG_CONTROL_PLANE');
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.metadata).toMatchObject({
      encodingProofId: PROOF_ID,
      encodingProofHash: PROOF_HASH,
      encodingProofAuthority: 'DSG_CONTROL_PLANE',
    });
  });

  it('fails closed when simulation drops or changes the authoritative proof binding', async () => {
    configureEnv();

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/dsg/v1/encoding/prove')) {
          const body = JSON.parse(String(init?.body)) as {
            problemId: string;
            encodingType: 'qubo-v1' | 'ising-v1';
            encoding: ControlPlaneEncoding;
          };
          return new Response(
            JSON.stringify({
              ok: true,
              status: 'PASS',
              proofId: PROOF_ID,
              proof: {
                proofId: PROOF_ID,
                proofHash: PROOF_HASH,
                encodingHash: controlPlaneEncodingHash(body.encoding),
                status: 'PASS',
                subject: {
                  problemId: body.problemId,
                  encodingType: body.encodingType,
                },
              },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }

        return new Response(
          JSON.stringify({
            ok: true,
            status: 'PASS',
            searchComplete: true,
            searchedAssignments: 4,
            encodingProofId: PROOF_ID,
            encodingProofHash: 'f'.repeat(64),
            encodingProofAuthority: 'DSG_CONTROL_PLANE',
            candidates: [{ answer: 'candidate-that-must-not-be-used' }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }),
    );

    const result = await solveSimulationShard({
      problem,
      shard,
      maxCandidates: 1,
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('BLOCKED');
    expect(result.candidates).toEqual([]);
    expect(result.error).toContain('did not preserve');
  });
});
