# DSG Step 2-14 Completion Map

## Scope
This document maps the current repository implementation to the planned DSG runtime steps. It is a route and evidence map, not a production claim.

## Status by Step
| Step | Repo Artifact | Runtime Status | Claim Boundary |
|---|---|---|---|
| 2 Database schema | `supabase/migrations/20260502174934_create_dsg_runtime_core_step_2.sql` | Source file present; already applied to dev Supabase in operator session | Not production |
| 2 Function hardening | `supabase/migrations/20260502175200_harden_dsg_runtime_functions_step_2.sql` | Source file present; already applied to dev Supabase in operator session | Not production |
| 3 Runtime core | `lib/dsg/runtime/*` | Deterministic JSON, hashing, planner, audit, evidence, replay, completion, no-mock guard | Build-time verifiable |
| 4 OpenAPI connector | `lib/dsg/connectors/openapi.ts` | Converts OpenAPI paths into governed tool definitions | Executor still pending |
| 5 API routes | `app/api/dsg/jobs/route.ts`, `app/api/dsg/verify/route.ts` | Fail-closed scaffold | Persistence not connected |
| 6 UI shell | `app/agi/page.tsx` | Truthful control page | No fake live data |
| 7 Repository layer | `lib/dsg/server/repository.ts` | Boundary exists; fails closed until Supabase client is wired | No mock persistence |
| 8 Planner | `lib/dsg/runtime/planner.ts` | DAG + wave plan + hash | Deterministic local logic |
| 9 Evidence/Audit | `lib/dsg/runtime/evidence.ts`, `lib/dsg/runtime/audit.ts` | Manifest and hash-chain logic | DB write routes pending |
| 10 Smoke/no-mock | `scripts/dsg-deterministic-runtime-check.mjs`, `lib/dsg/runtime/no-mock-guard.ts` | Static guard | Smoke is not production proof |
| 11 Auth/RBAC | `lib/dsg/server/context.ts` | Permission guard scaffold | Header actor is dev-only until server auth provider is wired |
| 12 Deployment proof | DB tables + completion gate fields | Data model ready | No deployment proof yet |
| 13 CI gates | `.github/workflows/dsg-verify.yml`, package scripts | CI configured | Passing CI must be observed |
| 14 Route map/runbook | docs files | Operator map present | No production claim |

## Required Commands
```bash
npm run dsg:claim-gate
npm run dsg:runtime-check
npm run dsg:typecheck
npm run dsg:verify
```

## Current Truthful Claim
- IMPLEMENTED: repository artifacts exist after merge.
- VERIFIED: only after CI or local command output passes.
- DEPLOYABLE: blocked until deployment evidence exists.
- PRODUCTION: blocked until auth/RBAC, evidence, audit export, replay, deployment proof, and production user-flow proof all pass.
