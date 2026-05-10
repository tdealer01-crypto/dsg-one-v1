# DSG Runtime RPC Consolidation Report

## Purpose

This report records the curated consolidation decision for the old DSG preview branches. The goal is to avoid blind-merging stale or diverged branches while keeping useful runtime, RPC, proof, and verification work in `main`.

## Rule

Do not merge old preview branches directly into `main` when they are diverged. Port only verified files or verified behavior into a fresh branch, then run local smoke/type/build checks before production deploy.

## Consolidated / already present in main

The current `main` already contains the useful runtime RPC surface and proof functions needed for the DSG runtime flow:

- `lib/dsg/server/repository.ts`
  - `listRuntimeJobs`
  - `getRuntimeJob`
  - `getRuntimeJobTimeline`
  - `createWorkspace`
  - `createRuntimeJob`
  - `createRuntimePlan`
  - `writeEvidence`
  - `createEvidenceManifest`
  - `createAuditExport`
  - `recordReplayProof`
  - `recordDeploymentProof`
  - `recordProductionFlowProof`
  - `createCompletionReport`

- API routes under `app/api/dsg/jobs/*`
  - job listing/creation
  - evidence writing
  - evidence manifest
  - replay proof
  - plan creation
  - audit export
  - deployment proof
  - production flow proof
  - completion report

- `app/api/dsg/workspaces/route.ts`

- `lib/dsg/server/context.ts`
  - verified actor and capability-gated request context

- `lib/dsg/server/supabase-rpc.ts`
  - Supabase REST/RPC adapter

- `scripts/dsg-deterministic-runtime-check.mjs`
  - runtime route/static proof checks

- `.github/workflows/dsg-verify.yml`
  - CI verification pipeline

## Branches treated as already included or superseded

- `dsg-app-builder-auth-rbac-hardening`
- `dsg-flow-studio-integration`
- `dsg-autonomous-level-gate`
- `dsg-autonomous-runtime-contracts`
- `dsg-ci-diagnostics`

These are either already in `main`, identical to current checked files, or superseded by the current DSG-owned autonomous naming and runtime proof layer.

## Branches not merged directly

The following branches are not merged as whole branches because they are diverged and may contain stale context or conflicting old assumptions:

- `dsg-backend-rpc-wiring`
- `dsg-completion-rpc-wiring`
- `dsg-deployment-proof-wiring`
- `dsg-server-verified-auth`

Useful behavior from these branches is represented by the current repository/API/RPC/auth files listed above. Any remaining future addition from them must be ported file-by-file with local verification.

## Branches explicitly excluded

Branches that contain non-DSG product naming or deprecated claim language are excluded from consolidation. The active product claim is DSG-owned:

- `DSG_AUTONOMOUS_LEVEL_PARTIAL`
- `DSG_AUTONOMOUS_LEVEL_COMPLETE`

## Verification commands

Run these before any production merge:

```bash
node scripts/dsg-runtime-rpc-consolidation-smoke.mjs
node scripts/dsg-autonomous-parallel-work-smoke.mjs
npm run lint
npm run dsg:typecheck
npm run build:termux
```

## Production smoke

After deploy:

```bash
BASE="https://dsg-one-v1.vercel.app"

for p in /dsg/autonomous-level /api/dsg/autonomous-level/status /dsg/flow-studio /api/dsg/flow-studio/config; do
  code=$(curl -L -s -o /tmp/dsg-runtime-check.html -w "%{http_code}" "$BASE$p")
  echo "$code $p"
done
```

Expected:

```text
200 /dsg/autonomous-level
200 /api/dsg/autonomous-level/status
200 /dsg/flow-studio
200 /api/dsg/flow-studio/config
```

## Claim boundary

This consolidation proves that the safe runtime/RPC/proof surface has been curated into the current codebase. It does not prove full autonomous runtime completion. Full completion still requires a real `provider-proof-bundle.json` that validates as `DSG_PROVIDER_PROOF_COMPLETE`.
