import { sha256Json } from '@/lib/dsg/runtime/hash';
import { materializeCandidate, normalizeAimoProblem } from './deterministic';
import { getAimoServiceConfig } from './service-registry';
import type {
  AimoCandidateInput,
  AimoProblemInput,
  AimoShard,
  AimoShardResult,
  AimoStrategyHint,
} from './types';

interface SimulationResponse {
  ok?: boolean;
  status?: 'PASS' | 'REVIEW' | 'BLOCKED';
  searchComplete?: boolean;
  searchedAssignments?: number;
  encodingHash?: string;
  candidates?: AimoCandidateInput[];
  replayHash?: string;
  error?: string;
}

export interface SolveSimulationShardInput {
  problem: AimoProblemInput;
  shard: AimoShard;
  strategyHint?: AimoStrategyHint;
  maxCandidates: number;
}

function simulationUrl(): URL {
  const base = getAimoServiceConfig().simulationUrl;
  if (!base) {
    throw new Error(
      'AIMO simulation URL is not configured. Set DSG_AIMO_SERVICE_REGISTRY or legacy DSG_AGI_SIMULATION_URL.',
    );
  }

  const url = new URL('/v1/aimo/solve-shard', base);
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('AIMO simulation URL must use HTTPS in production');
  }
  return url;
}

export async function solveSimulationShard(
  input: SolveSimulationShardInput,
): Promise<AimoShardResult> {
  try {
    const config = getAimoServiceConfig();
    const url = simulationUrl();
    const apiKey = config.simulationApiKey;
    const normalized = normalizeAimoProblem(input.problem);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        schemaVersion: 'dsg-aimo-v1',
        problem: normalized,
        problemHash: input.shard.problemHash,
        shard: input.shard,
        maxCandidates: input.maxCandidates,
        strategyHint: input.strategyHint
          ? {
              provider: input.strategyHint.provider,
              model: input.strategyHint.model,
              text: input.strategyHint.text,
              responseHash: input.strategyHint.responseHash,
            }
          : null,
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      return {
        shard: input.shard,
        ok: false,
        searchComplete: false,
        candidates: [],
        error: `simulation HTTP ${response.status}`,
      };
    }

    const body = (await response.json()) as SimulationResponse;
    if (body.ok !== true || !Array.isArray(body.candidates)) {
      return {
        shard: input.shard,
        ok: false,
        status: body.status,
        searchComplete: false,
        candidates: [],
        error: body.error ?? 'simulation response schema invalid',
      };
    }

    const bounded = body.candidates.slice(0, input.maxCandidates);
    const candidates = bounded.map((candidate) =>
      materializeCandidate(candidate, input.shard),
    );

    return {
      shard: input.shard,
      ok: true,
      status: body.status,
      searchComplete: body.searchComplete === true,
      searchedAssignments:
        typeof body.searchedAssignments === 'number'
          ? body.searchedAssignments
          : undefined,
      encodingHash:
        typeof body.encodingHash === 'string' ? body.encodingHash : undefined,
      candidates,
      replayHash:
        body.replayHash ??
        sha256Json({
          shard: input.shard,
          candidates: candidates.map((item) => item.candidateHash),
        }),
    };
  } catch (error) {
    return {
      shard: input.shard,
      ok: false,
      searchComplete: false,
      candidates: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
