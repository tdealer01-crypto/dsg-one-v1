# AGI DSG Deterministic Runtime Build Plan

## Purpose
This file is the build-control document for the `agi` project inside `tdealer01-crypto/dsg-one-v1`.

The system must not claim completion, deployability, or production readiness from chat text, demos, mock state, or intention. Claims are allowed only when evidence exists in the repository and can be checked by scripts, CI, audit logs, and replay proof.

## Claim Levels
| Claim | Meaning | Required Evidence |
|---|---|---|
| BUILDABLE | Design and file plan exist | Work ledger, route map, invariant spec |
| IMPLEMENTED | Files exist in repo | Commit/PR contains files |
| VERIFIED | Tests/checks pass | CI or local logs for typecheck, tests, claim gate |
| DEPLOYABLE | Deployment proof passes | Deployment URL verification and environment proof |
| PRODUCTION | Real production user-flow proof passes | Auth/RBAC, evidence, audit, replay, deployment, and real user-flow proof |

## Non-Negotiable Gates
- No evidence item -> completion must be blocked.
- No audit export -> completion must be blocked.
- No replay proof -> completion must be blocked.
- Mock/local/memory state -> production claim must be blocked.
- Dev/test/smoke-only environment -> production claim must be blocked.
- Header-supplied role -> cannot be a production trust boundary.
- External mutation -> must go through a governed executor and audit path.

## Ordered Build Sequence
1. Control docs and ledger.
2. Shared TypeScript claim/status types.
3. Supabase schema for runtime jobs, events, evidence, audit, replay, auth/RBAC, deployment proofs.
4. Deterministic runtime libs: stable JSON, hash, DAG, wave plan, gate checks.
5. OpenAPI-to-governed-tool generator.
6. Fail-closed API routes.
7. Control Plane UI shell that renders backend state only.
8. Repository layer for all DB access.
9. Planner and wave APIs.
10. Evidence and audit write APIs.
11. Smoke flow and no-mock guard.
12. Server-side Auth/RBAC.
13. Deployment evidence and production flow proof.
14. CI gates, route map, operator runbook.

## Thai Law Truthfulness Posture
This project must avoid misleading consumer or business claims. Product pages, UI, API responses, logs, and reports must not state `production-ready`, `verified`, `secure`, `compliant`, or `deployed` unless the matching proof exists.

## Z3 / SMT Deterministic Posture
The repo includes a formal invariant draft in `formal/dsg-claim-gate-invariants.smt2`. It is a specification artifact. It is not a proof result until an SMT solver run is attached as evidence.

## Current Build Boundary
This patch is a truthful starting layer: ledger, route map, runbook, claim gate, basic UI entry, and local static claim-gate check. It does not implement the full runtime database, API executor, or production deployment proof yet.
