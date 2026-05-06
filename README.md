# DSG ONE V1 — Governed App Builder Runtime

> **From user goal → PRD → plan gate → approval → runtime handoff → generated app evidence.**

DSG ONE V1 is a governed AI app-builder and action-runtime control plane. It is designed to make app generation visible, reviewable, auditable, and fail-closed before anyone claims a generated workflow is production-ready.

Core rule:

```text
No action before plan, gate, approval, runtime evidence, and audit.
```

This repository is a public implementation workspace for the **DSG App Builder Agent Runtime**. It includes product pages, API routes, deterministic checks, memory/context routes, generated-app routes, product-readiness gates, Termux/mobile build support, and verification scripts.

It is not, by itself, proof of completed production go-live. A live production claim still requires runtime evidence, environment proof, GitHub PR output, audit rows, build/deploy proof, and production-flow proof.

---

## What the user sees first

| Surface | Path | User value |
|---|---:|---|
| App Builder Console | `/dsg/app-builder` | See a prompt-to-PRD, template registry, Z3 observer boundary, and proof checklist before execution. |
| Job Detail | `/dsg/app-builder/[jobId]` | Inspect a specific job, plan, approval, runtime handoff, and proof state. |
| Product Ready Gate | `/product-ready` | See whether the app is PASS / WARN / BLOCKED and what action is required next. |
| Generated App | `/generated-apps/[appId]` | Inspect generated-app output and implementation evidence. |
| DSG APIs | `/api/dsg/*` | Register jobs, run gates, search memory, start runtime, replay jobs, and return production-flow proof. |

The UI should answer these questions clearly:

```text
1. What did the user ask DSG to build?
2. Is the goal locked and converted into a PRD?
3. Did the plan pass the gate?
4. Did a human/operator approve runtime handoff?
5. What exact tool/action ran?
6. What evidence exists: hashes, branch, PR, audit row, callback, replay proof?
7. Is the result blocked, unverified, deployable, or production verified?
8. What must the user do next?
```

---

## Product flow

```text
User goal
  -> Goal lock
  -> PRD + proposed plan
  -> Plan gate
  -> Approval
  -> Runtime handoff
  -> App Builder orchestration tool
  -> Runtime environment provisioner
  -> Agent action layer
  -> Full-stack build tool
  -> GitHub branch / PR evidence
  -> DB-backed audit
  -> Notification / result
  -> Product-ready check
```

The intended first customer outcome is deliberately narrow and provable:

```text
one goal -> one governed plan -> one approved runtime handoff -> one generated artifact -> one evidence trail
```

---

## Claim vocabulary

| Claim | Meaning |
|---|---|
| `PLANNED_ONLY` | PRD/plan exists, but no approved runtime action has occurred. |
| `APPROVED_ONLY` | Plan was approved, but execution evidence is still missing. |
| `ENVIRONMENT_READY` | Runtime environment/manifest exists, but build/deploy proof is not complete. |
| `IMPLEMENTED_UNVERIFIED` | Code/PR evidence exists, but CI/deploy/production proof is still incomplete. |
| `DEPLOYABLE` | Build and deployment gates have passed with evidence. |
| `PRODUCTION_VERIFIED` | Real production-flow proof passed with recorded evidence. |
| `BLOCKED` | Required environment, approval, proof, or audit evidence is missing. |

Safe wording:

```text
governed app-builder runtime
evidence-ready scaffold
product-ready gate
runtime handoff proof
GitHub PR evidence path
deterministic runtime check
Termux/mobile build support
```

Do not claim unless newer evidence proves it:

```text
fully autonomous production builder
certified enterprise system
guaranteed compliant
completed production go-live
production verified without live proof
mock data as production evidence
```

---

## App Builder tools

### `dsg.app_builder.launch_agent_runtime`

Top-level orchestration tool. It runs only after the plan has passed gate and approval.

Responsibilities:

- verify approved runtime handoff
- provision a runtime environment
- expose the DSG action-layer contract
- call the full-stack build tool
- create audit data
- return a user-visible notification/result payload

### `dsg.app_builder.generate_fullstack_pr`

Lower-level build tool used by the orchestration tool.

Responsibilities:

- generate a Next.js frontend route
- generate a backend API route
- generate a Supabase migration
- generate an evidence runbook
- write generated files to a GitHub branch
- open a GitHub PR as implementation evidence

---

## Runtime environment evidence

The runtime environment provisioner writes an environment manifest before build execution.

Evidence should include:

```text
repository
base branch
runtime branch
manifest path
planHash
approvalHash
allowed tools
allowed paths
required secrets
```

This is environment evidence only. It is not build, deployment, or production proof by itself.

---

## DB-backed audit

Tool calls are written to Supabase through:

```text
dsg_app_builder_tool_audits
```

The audit row stores:

```text
app builder job id
workspace id
actor id
tool name
outcome
evidence refs
audit event JSON
created timestamp
```

Relevant migration:

```text
supabase/migrations/202605040002_app_builder_tool_audit_and_env_status.sql
```

---

## Required environment variables

Server/runtime environment:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GITHUB_TOKEN=
DSG_BUILDER_GITHUB_OWNER=tdealer01-crypto
DSG_BUILDER_GITHUB_REPO=dsg-one-v1
DSG_BUILDER_BASE_BRANCH=main
```

Optional deploy/proof variables:

```bash
VERCEL_TOKEN=
VERCEL_ORG_ID=
VERCEL_PROJECT_ID=
NEXT_TELEMETRY_DISABLED=1
```

If required runtime variables are missing, the runtime must fail closed instead of falling back to mock production evidence.

---

## Local development

Prerequisites:

```text
Node.js 20+
npm
Supabase project with required migrations applied
GitHub token with repository write permissions for runtime PR generation
```

Install dependencies:

```bash
npm install
```

Start development server:

```bash
npm run dev
```

Run production build:

```bash
npm run build
```

Run full DSG verification:

```bash
npm run dsg:verify
```

Available DSG scripts:

```bash
npm run dsg:claim-gate
npm run dsg:runtime-check
npm run dsg:typecheck
npm run dsg:production-flow-check
npm run dsg:product-ready
npm run dsg:verify
npm run smoke:app-builder-flow-proof
npm run smoke:memory-api
```

---

## Termux / Android local workflow

This repo includes mobile-friendly scripts for Termux builds and dev server behavior.

Use these instead of raw `next build` when building on Termux:

```bash
npm run clean
npm run build:termux
```

For Termux dev server:

```bash
npm run dev:termux
```

Why this exists:

```text
Android/Termux can fail on Next.js webpack cache, PostCSS/Tailwind dependency snapshotting, and watcher permissions.
The wrapper disables unsafe cache paths, applies deterministic mobile build fallback where needed, restores files after build, and keeps local proof possible without spending Vercel quota.
```

---

## API surface

Key App Builder endpoints:

```text
POST /api/dsg/app-builder/jobs
POST /api/dsg/app-builder/jobs/:jobId/plan
POST /api/dsg/app-builder/jobs/:jobId/approval
POST /api/dsg/app-builder/jobs/:jobId/runtime-handoff
GET  /api/dsg/app-builder/tools
POST /api/dsg/app-builder/jobs/:jobId/tool-call
```

Runtime and proof endpoints:

```text
POST /api/dsg/jobs/:jobId/runtime/start
POST /api/dsg/jobs/:jobId/replay
GET  /api/dsg/jobs/:jobId/production-flow-proof
POST /api/dsg/runtime/build-proof/callback
POST /api/dsg/runtime/production-flow/callback
GET  /api/dsg/product-ready
GET  /api/dsg/verify
```

Memory/context endpoints:

```text
POST /api/dsg/memory/ingest
POST /api/dsg/memory/search
POST /api/dsg/memory/gate
GET  /api/dsg/memory/context-pack
GET  /api/dsg/workspaces
```

Top-level App Builder tool-call payload:

```json
{
  "toolName": "dsg.app_builder.launch_agent_runtime",
  "arguments": {
    "mode": "agent_runtime_fullstack_pr"
  }
}
```

---

## Product-ready verification checklist

Do not claim runtime success until the evidence exists:

- [ ] Supabase migrations applied successfully
- [ ] `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` configured in deployment environment
- [ ] `GITHUB_TOKEN` configured with repository write permission
- [ ] User can create an App Builder job
- [ ] PRD and proposed plan are generated
- [ ] Plan gate result is visible
- [ ] Approval is recorded
- [ ] Runtime handoff returns matching `planHash` and `approvalHash`
- [ ] `dsg.app_builder.launch_agent_runtime` executes successfully
- [ ] Runtime environment manifest is written to GitHub
- [ ] GitHub PR is created with generated full-stack files
- [ ] `dsg_app_builder_tool_audits` receives an audit row
- [ ] CI/typecheck/lint/build pass
- [ ] Deployment proof passes
- [ ] Production-flow proof passes before any `PRODUCTION_VERIFIED` claim

---

## Non-mock policy

This repo must not present mock/local/browser-only state as production evidence.

Allowed evidence includes:

```text
database rows
GitHub commits / branches / PRs
Vercel deployment status
build logs
migration results
audit rows
replay/proof artifacts
browser-visible status after real execution
```

If evidence is missing, the UI and API must report a blocked or unverified status rather than implying completion.

---

## Quick verification sequence

Recommended local check before pushing or deploying:

```bash
npm run dsg:claim-gate
npm run dsg:runtime-check
npm run dsg:typecheck
npm run lint
npm run dsg:product-ready
npm run build
```

On Termux:

```bash
npm run dsg:claim-gate
npm run dsg:runtime-check
npm run dsg:typecheck
npm run lint
npm run dsg:product-ready
npm run build:termux
```

---

## Current status summary

```text
IMPLEMENTED:
- App Builder product console
- Product-ready page and API
- Runtime handoff routes
- Runtime start/replay/proof callback routes
- Memory/context endpoints
- Deterministic runtime check script
- Termux/mobile build wrapper
- DB-backed audit path scaffolding

STILL REQUIRES LIVE EVIDENCE BEFORE PRODUCTION_VERIFIED:
- Supabase applied-state proof
- successful live App Builder runtime run
- generated GitHub PR evidence
- audit row evidence
- deployment proof
- production-flow proof
```

---

## Practical boundary

DSG ONE V1 is a production-oriented governed app-builder runtime stack. It is product-ready as an implementation surface and proof workflow, but each customer or production claim must still be backed by live evidence from that environment.
