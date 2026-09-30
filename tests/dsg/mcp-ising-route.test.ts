import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  validateApiKeyFromHeaders: vi.fn(),
  recordApiKeyUsage: vi.fn(),
  getNvidiaIsingStrategy: vi.fn(),
}));

vi.mock('@/lib/dsg/mcp/validate-api-key', () => ({
  validateApiKeyFromHeaders: mocks.validateApiKeyFromHeaders,
  recordApiKeyUsage: mocks.recordApiKeyUsage,
}));

vi.mock('@/lib/dsg/aimo/nvidia-ising', () => ({
  getNvidiaIsingStrategy: mocks.getNvidiaIsingStrategy,
}));

import { POST } from '../../app/api/mcp-server/route';

type ToolArgs = Record<string, unknown>;

async function callIsing(
  args: ToolArgs,
  headers: Record<string, string> = {},
) {
  const response = await POST(
    new Request('https://example.test/api/mcp-server', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'test',
        method: 'tools/call',
        params: {
          name: 'physics_ising_strategy',
          arguments: args,
        },
      }),
    }),
  );
  const rpc = await response.json() as {
    error?: unknown;
    result?: { content?: Array<{ type?: string; text?: string }> };
  };
  const text = rpc.result?.content?.[0]?.text;
  return {
    rpc,
    toolResult: text ? JSON.parse(text) as Record<string, unknown> : undefined,
  };
}

describe('MCP physics_ising_strategy governance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('APP_URL', 'https://example.test');
    mocks.recordApiKeyUsage.mockResolvedValue(undefined);
    mocks.getNvidiaIsingStrategy.mockResolvedValue({
      provider: 'nvidia-ising',
      model: 'nvidia/ising-calibration-1.5-31b',
      text: 'advisory strategy',
      responseHash: 'sha256:test',
      mode: 'live',
      determinism: 'EXTERNAL_PROVIDER_NOT_GUARANTEED',
    });
  });

  it('blocks unauthenticated live compute before provider invocation', async () => {
    mocks.validateApiKeyFromHeaders.mockResolvedValue({ valid: false });

    const { toolResult } = await callIsing({
      problem: { statement: 'Minimize x + y.' },
      mode: 'live',
    });

    expect(toolResult).toMatchObject({
      ok: false,
      verdict: 'BLOCKED',
      error: 'INVALID_API_KEY',
    });
    expect(mocks.recordApiKeyUsage).not.toHaveBeenCalled();
    expect(mocks.getNvidiaIsingStrategy).not.toHaveBeenCalled();
  });

  it('blocks live compute if usage metering fails', async () => {
    mocks.validateApiKeyFromHeaders.mockResolvedValue({
      valid: true,
      keyId: 'key-1',
      actorId: 'actor-1',
      planId: 'plan-1',
      callsUsed: 0,
      callsLimit: 10,
    });
    mocks.recordApiKeyUsage.mockRejectedValue(new Error('meter unavailable'));

    const { toolResult } = await callIsing(
      {
        problem: { statement: 'Minimize x + y.' },
        mode: 'live',
      },
      { 'x-dsg-api-key': 'dsg_test_key' },
    );

    expect(toolResult).toMatchObject({
      ok: false,
      verdict: 'BLOCKED',
      error: 'USAGE_METER_FAILED',
    });
    expect(mocks.getNvidiaIsingStrategy).not.toHaveBeenCalled();
  });

  it('rejects malformed modes instead of coercing them to live', async () => {
    const { toolResult } = await callIsing({
      problem: { statement: 'Minimize x + y.' },
      mode: 'pinnned',
      pinnedText: 'do not send this to a provider',
    });

    expect(toolResult).toMatchObject({
      ok: false,
      verdict: 'BLOCKED',
      error: 'INVALID_MODE',
    });
    expect(mocks.validateApiKeyFromHeaders).not.toHaveBeenCalled();
    expect(mocks.recordApiKeyUsage).not.toHaveBeenCalled();
    expect(mocks.getNvidiaIsingStrategy).not.toHaveBeenCalled();
  });

  it('returns a tool-level BLOCKED result when the provider fails', async () => {
    mocks.validateApiKeyFromHeaders.mockResolvedValue({
      valid: true,
      keyId: 'key-1',
      actorId: 'actor-1',
      planId: 'plan-1',
      callsUsed: 0,
      callsLimit: 10,
    });
    mocks.getNvidiaIsingStrategy.mockRejectedValue(
      new Error('NVIDIA_API_KEY is not configured'),
    );

    const { rpc, toolResult } = await callIsing(
      {
        problem: { statement: 'Minimize x + y.' },
        mode: 'live',
      },
      { 'x-dsg-api-key': 'dsg_test_key' },
    );

    expect(rpc.error).toBeUndefined();
    expect(toolResult).toMatchObject({
      ok: false,
      verdict: 'BLOCKED',
      error: 'ISING_STRATEGY_UNAVAILABLE',
    });
  });

  it('returns BLOCKED with an actionable nextAction for missing pinned text', async () => {
    mocks.getNvidiaIsingStrategy.mockRejectedValue(
      new Error('pinned NVIDIA Ising mode requires pinnedText'),
    );

    const { toolResult } = await callIsing({
      problem: { statement: 'Minimize x + y.' },
      mode: 'pinned',
    });

    expect(toolResult).toMatchObject({
      ok: false,
      verdict: 'BLOCKED',
      error: 'ISING_STRATEGY_UNAVAILABLE',
      nextAction: 'Provide a non-empty pinnedText for pinned replay.',
    });
    expect(mocks.validateApiKeyFromHeaders).not.toHaveBeenCalled();
    expect(mocks.recordApiKeyUsage).not.toHaveBeenCalled();
  });

  it('meters authenticated live compute before invoking NVIDIA and preserves advisory authority', async () => {
    mocks.validateApiKeyFromHeaders.mockResolvedValue({
      valid: true,
      keyId: 'key-1',
      actorId: 'actor-1',
      planId: 'plan-1',
      callsUsed: 0,
      callsLimit: 10,
    });

    const { toolResult } = await callIsing(
      {
        problem: {
          statement: 'Minimize x + y.',
          constraints: { x: 'binary', y: 'binary' },
        },
        mode: 'live',
      },
      { 'x-dsg-api-key': 'dsg_test_key' },
    );

    expect(mocks.recordApiKeyUsage).toHaveBeenCalledWith(
      'key-1',
      'actor-1',
      'physics-ising-strategy',
    );
    expect(mocks.recordApiKeyUsage.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.getNvidiaIsingStrategy.mock.invocationCallOrder[0],
    );
    expect(mocks.getNvidiaIsingStrategy).toHaveBeenCalledWith(
      expect.objectContaining({
        constraints: { x: 'binary', y: 'binary' },
      }),
      expect.objectContaining({ mode: 'live' }),
    );
    expect(toolResult).toMatchObject({
      ok: true,
      verdict: 'ADVISORY',
      authority: 'ADVISORY_ONLY',
    });
  });
});
