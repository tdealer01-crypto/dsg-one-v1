import crypto from 'node:crypto';

export interface EncodingProofRequest {
  problemId?: string;
  encodingType: 'qubo-v1' | 'ising-v1';
  encoding: {
    kind: 'qubo-v1' | 'ising-v1';
    variableCount: number;
    constant?: string | number;
    linear?: Array<{ i: number; weight: string | number }>;
    quadratic?: Array<{ i: number; j: number; weight: string | number }>;
    h?: Array<{ i: number; weight: string | number }>;
    j?: Array<{ i: number; j: number; weight: string | number }>;
    objective?: 'min' | 'max';
  };
  nonce: string;
  idempotencyKey: string;
}

export interface EncodingProofResponse {
  ok: boolean;
  proofId?: string;
  status: 'PASS' | 'BLOCK' | 'REVIEW';
  proof?: {
    proofId: string;
    encodingHash: string;
    status: 'PASS' | 'BLOCK' | 'REVIEW';
    checks: Record<string, boolean>;
  };
  error?: string;
  failedChecks?: string[];
  failureReasons?: string[];
}

export interface EncodingProofClientConfig {
  controlPlaneUrl: string;
  apiKey?: string;
  timeoutMs?: number;
  cacheEnabled?: boolean;
  cacheTtlSeconds?: number;
}

// Simple in-memory cache for encoding proofs
const proofCache = new Map<string, { proof: EncodingProofResponse; expiresAt: number }>();

function getCacheKey(encoding: EncodingProofRequest['encoding']): string {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(encoding));
  return `proof_${hash.digest('hex')}`;
}

function getCachedProof(key: string): EncodingProofResponse | null {
  const cached = proofCache.get(key);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    proofCache.delete(key);
    return null;
  }
  return cached.proof;
}

function cacheProof(
  key: string,
  proof: EncodingProofResponse,
  ttlSeconds: number = 1800, // 30 minutes default
): void {
  proofCache.set(key, {
    proof,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Request encoding proof from control plane
 */
export async function requestEncodingProof(
  request: EncodingProofRequest,
  config: EncodingProofClientConfig,
): Promise<EncodingProofResponse> {
  const cacheKey = getCacheKey(request.encoding);

  // Check cache if enabled
  if (config.cacheEnabled !== false) {
    const cached = getCachedProof(cacheKey);
    if (cached) {
      return cached;
    }
  }

  try {
    const url = `${config.controlPlaneUrl.replace(/\/$/, '')}/api/dsg/v1/encoding/prove`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add API key if provided
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      config.timeoutMs ?? 5000,
    );

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Control plane returned ${response.status}`);
    }

    const proof = (await response.json()) as EncodingProofResponse;

    // Cache the result
    if (config.cacheEnabled !== false) {
      cacheProof(cacheKey, proof, config.cacheTtlSeconds);
    }

    return proof;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      status: 'BLOCK',
      error: `Encoding proof request failed: ${message}`,
    };
  }
}

/**
 * Check if proof indicates acceptable status for solver execution
 */
export function isProofAcceptable(proof: EncodingProofResponse): boolean {
  return proof.ok === true && proof.status === 'PASS';
}

/**
 * Get human-readable summary of proof status
 */
export function getProofSummary(proof: EncodingProofResponse): string {
  if (!proof.ok) {
    return `Proof validation failed: ${proof.error || 'unknown error'}`;
  }

  if (proof.status === 'PASS') {
    return 'Encoding proof validated successfully';
  }

  if (proof.status === 'BLOCK') {
    const reasons = proof.failureReasons?.join('; ') || 'unknown constraints';
    return `Encoding proof blocked: ${reasons}`;
  }

  if (proof.status === 'REVIEW') {
    const reasons = proof.failureReasons?.join('; ') || 'review required';
    return `Encoding proof requires review: ${reasons}`;
  }

  return 'Unknown proof status';
}

/**
 * Clear all cached proofs
 */
export function clearProofCache(): void {
  proofCache.clear();
}

/**
 * Get cache statistics
 */
export function getProofCacheStats(): { size: number; memoryEstimate: number } {
  let memoryEstimate = 0;
  for (const [key, value] of proofCache.entries()) {
    memoryEstimate += key.length + JSON.stringify(value.proof).length;
  }
  return {
    size: proofCache.size,
    memoryEstimate,
  };
}
