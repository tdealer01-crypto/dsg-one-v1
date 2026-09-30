import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getNvidiaIsingStrategy } from '../../lib/dsg/aimo/nvidia-ising';

describe('NVIDIA Ising strategy prompt', () => {
  beforeEach(() => {
    vi.stubEnv('NVIDIA_API_KEY', 'test-nvidia-key');
    vi.stubEnv('NVIDIA_NIM_BASE_URL', 'https://integrate.api.nvidia.com');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('serializes structured problem constraints into the provider prompt', async () => {
    let capturedBody: Record<string, unknown> | undefined;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        capturedBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Use a binary quadratic encoding.' } }],
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        );
      }),
    );

    const result = await getNvidiaIsingStrategy(
      {
        problemId: 'constraints-proof',
        statement: 'Find the minimum-energy feasible assignment.',
        domain: 'qubo',
        constraints: {
          cardinality: 2,
          parity: 'even',
        },
      },
      { mode: 'live' },
    );

    const messages = capturedBody?.messages as
      | Array<{ role?: string; content?: string }>
      | undefined;
    const prompt = messages?.[0]?.content ?? '';

    expect(prompt).toContain('Constraints:');
    expect(prompt).toContain(
      JSON.stringify({
        cardinality: 2,
        parity: 'even',
      }),
    );
    expect(result).toMatchObject({
      provider: 'nvidia-ising',
      mode: 'live',
      determinism: 'EXTERNAL_PROVIDER_NOT_GUARANTEED',
    });
  });
});
