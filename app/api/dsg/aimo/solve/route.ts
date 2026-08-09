import { NextRequest, NextResponse } from 'next/server';
import { runAimoHarness } from '@/lib/dsg/aimo/harness';
import { validateApiKeyFromHeaders, recordApiKeyUsage } from '@/lib/dsg/mcp/validate-api-key';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const validation = await validateApiKeyFromHeaders(new Headers(req.headers));
    if (!validation.valid) {
      return NextResponse.json(
        {
          ok: false,
          verdict: 'BLOCKED',
          error: 'INVALID_API_KEY',
          nextAction: 'Provide a valid X-DSG-Api-Key before running competition compute.',
        },
        { status: 401 },
      );
    }

    const body = await req.json();
    const statement =
      typeof body?.problem?.statement === 'string'
        ? body.problem.statement
        : '';

    if (!statement.trim()) {
      return NextResponse.json(
        { ok: false, verdict: 'BLOCKED', error: 'problem.statement is required' },
        { status: 400 },
      );
    }

    try {
      await recordApiKeyUsage(validation.keyId, validation.actorId, 'aimo-solve');
    } catch (error) {
      return NextResponse.json(
        {
          ok: false,
          verdict: 'BLOCKED',
          error: 'USAGE_METER_FAILED',
          detail: error instanceof Error ? error.message : String(error),
          nextAction: 'Restore DSG API-key metering before running competition compute.',
        },
        { status: 503 },
      );
    }

    const receipt = await runAimoHarness({
      problem: {
        problemId:
          typeof body.problem.problemId === 'string'
            ? body.problem.problemId
            : undefined,
        statement,
        domain:
          typeof body.problem.domain === 'string'
            ? body.problem.domain
            : undefined,
        constraints:
          body.problem.constraints &&
          typeof body.problem.constraints === 'object'
            ? body.problem.constraints
            : undefined,
      },
      shardCount:
        typeof body.shardCount === 'number' ? body.shardCount : undefined,
      parallelism:
        typeof body.parallelism === 'number' ? body.parallelism : undefined,
      maxCandidatesPerShard:
        typeof body.maxCandidatesPerShard === 'number'
          ? body.maxCandidatesPerShard
          : undefined,
      requireAllShards:
        typeof body.requireAllShards === 'boolean'
          ? body.requireAllShards
          : undefined,
      nvidiaIsing:
        body.nvidiaIsing && typeof body.nvidiaIsing === 'object'
          ? {
              mode: body.nvidiaIsing.mode,
              pinnedText: body.nvidiaIsing.pinnedText,
              model: body.nvidiaIsing.model,
            }
          : { mode: 'off' },
    });

    return NextResponse.json({ ok: receipt.verdict === 'PASS', data: receipt });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        verdict: 'BLOCKED',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'DSG AIMO Harness v1',
    endpoint: '/api/dsg/aimo/solve',
    deterministicCore: true,
    searchEngine: 'DSG AGI Simulation via /v1/aimo/solve-shard',
    strategyProvider: 'NVIDIA Ising NIM optional; live output is advisory only',
    verifier: 'DSG Cinema Proof Agent structured certificate endpoint',
    authentication: 'POST requires a valid X-DSG-Api-Key and fail-closed usage metering.',
    truthBoundary:
      'No natural-language answer is accepted on trust. Final PASS requires a structured verifier response. Live NVIDIA NIM output is not claimed byte-deterministic; pin it for full replay. Competition compute is unavailable when authentication or metering fails.',
  });
}
