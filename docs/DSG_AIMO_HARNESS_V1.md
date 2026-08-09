# DSG AIMO Harness v1

Status: **REVIEW until CI and live adapters are verified**

## Goal

Build an AIMO-style solving loop where search and truth are separate:

1. DSG ONE receives a new problem.
2. The problem is normalized and SHA-256 hashed.
3. The search space is split into deterministic shards.
4. Shards run in parallel through `dsg-agi-simulation`.
5. NVIDIA Ising NIM may supply an advisory strategy hint.
6. Every returned candidate is hashed and ordered canonically.
7. A candidate can PASS only through a structured verifier contract.
8. The final receipt is hashed so the run can be replayed and audited.

## Deterministic invariant

`parallelism` is deliberately excluded from `runId`.

For identical:

- normalized problem
- shard count
- shard algorithm version
- pinned strategy input
- simulation implementation/version
- verifier implementation/version

the deterministic core must produce the same shard IDs, seeds, candidate hashes,
canonical winner, and receipt hash whether it runs with 1 worker or many workers.
Cinema audit-event hashes are history-dependent and therefore excluded from the deterministic `receiptHash`; the stable Cinema `proof_hash` and certificate level are bound instead.

The v1 HTTP implementation caps in-request parallelism at 64 to avoid serverless
resource exhaustion. This is an execution cap, not an algorithmic dependency.
A distributed scheduler can execute the same deterministic shard plan across more
workers without changing the canonical result.

## NVIDIA Ising truth boundary

The current NVIDIA NIM model wired by this patch is:

`nvidia/ising-calibration-1.5-31b`

NVIDIA documents it as a quantum-computing calibration vision-language model.
It is therefore connected as a **strategy/advice source**, not as the authoritative
QUBO optimizer and not as the proof verifier.

Two modes are supported:

- `live`: call NVIDIA NIM; receipt is `CORE_ONLY` deterministic because remote
  model output is not claimed byte-identical across fresh calls.
- `pinned`: reuse stored strategy text; its hash becomes a deterministic run input
  and the run can be `FULL` deterministic.

## DSG AGI Simulation contract

Configure:

`DSG_AGI_SIMULATION_URL`

The harness calls:

`POST /v1/aimo/solve-shard`

Expected request fields include:

- `schemaVersion`
- normalized `problem`
- `problemHash`
- deterministic `shard` (`index`, `shardId`, `seed`)
- `maxCandidates`
- optional NVIDIA strategy hint + hash

Expected response. `searchComplete` is authoritative for coverage accounting; HTTP `ok=true` alone never means the shard was exhaustively searched:

```json
{
  "ok": true,
  "status": "PASS",
  "searchComplete": true,
  "searchedAssignments": 1024,
  "encodingHash": "sha256:...",
  "replayHash": "sha256:...",
  "candidates": [
    {
      "answer": "...",
      "proof": "...",
      "witness": {},
      "verification": {
        "kind": "z3-witness",
        "endpoint": "/v1/verify",
        "payload": {}
      }
    }
  ]
}
```

No candidate receives PASS merely because simulation found it. For the exact QUBO/Ising path, the simulation verification payload must include the full canonical `problem` envelope (not only `problemHash`) and `proveOptimality: true`, so Cinema can independently recompute the problem hash and prove global optimality.

## Verifier contract

Configure:

`DSG_CINEMA_PROOF_URL`

Allowed verifier endpoint prefixes:

- `/v1/verify`
- `/v1/hybrid/`
- `/v1/math/`

Supported verification kinds:

### `z3-witness`

PASS requires all of:

- `accepted === true`
- `z3_status === "SAT"`
- `all_constraints_satisfied === true`

This certifies the supplied formalized witness constraints only. It does not prove
that an incorrect formalization matches the original natural-language problem.

### `proof-certificate`

PASS requires:

- `verdict === "PASS"`
- `proof_complete === true`

### `lean-replay`

PASS requires:

- `reproducible_formal_proof === "PASS"`
- `sorryAx === false`

## API authentication

`POST /api/dsg/aimo/solve` is fail-closed and requires a valid `X-DSG-Api-Key` using the existing DSG MCP API-key validator. Usage metering must also succeed before competition compute starts. `GET` remains a non-compute capability surface.

## API

`POST /api/dsg/aimo/solve`

Example:

```json
{
  "problem": {
    "problemId": "sealed-001",
    "statement": "..."
  },
  "shardCount": 64,
  "parallelism": 16,
  "maxCandidatesPerShard": 8,
  "requireAllShards": true,
  "nvidiaIsing": {
    "mode": "off"
  }
}
```

For a fully replayable run using an already captured NVIDIA strategy:

```json
{
  "nvidiaIsing": {
    "mode": "pinned",
    "pinnedText": "..."
  }
}
```

## Coverage vs global proof

`searchCoverage=COMPLETE` requires every deterministic shard to return `searchComplete=true`. A successful HTTP response is not enough.

A Cinema certificate with `certificate_level=VERIFIED_GLOBAL_OPTIMUM` is stronger than shard coverage: Cinema independently asks Z3 whether any lower-energy assignment exists in the full finite encoding. Therefore the harness may return final PASS even when shard coverage is partial **only** when that independent global-optimum certificate is present.

## Readiness

### Implemented by this patch

- deterministic problem hashing
- deterministic shard IDs and seeds
- parallel execution independent of result ordering
- canonical candidate hashing and selection
- fail-closed verifier contract
- optional NVIDIA Ising live/pinned strategy
- tamper-evident run receipt hash
- unit tests for parallelism invariance and fail-closed behavior

### Still required before production PASS

1. Implement and verify `/v1/aimo/solve-shard` in `dsg-agi-simulation`.
2. Configure a real deployed `DSG_AGI_SIMULATION_URL`.
3. Add per-problem formal encoders/verifiers in Cinema Proof Agent.
4. Run repository CI: typecheck, lint, tests, build and existing DSG smoke gates.
5. Run a sealed unseen Olympiad benchmark with no human intervention.
6. Measure score, latency, compute budget, replay rate, and verifier false-positive rate.

Do not claim AIMO gold-level performance until the sealed benchmark evidence exists.

## Sealed replay smoke

After all three services are deployed and environment variables are configured:

```bash
export DSG_AIMO_APP_URL="https://<dsg-one-host>"
export DSG_API_KEY="<valid-dsg-api-key>"
npm run smoke:aimo-sealed
```

The smoke runs the same request twice and requires stable `problemHash`, `shardPlanHash`, selected candidate hash, Cinema `proofHash`, and deterministic `receiptHash`. To use a private unseen benchmark problem instead of the built-in connectivity QUBO, set `DSG_AIMO_PROBLEM_FILE=/path/to/problem.json`.
