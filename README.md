# DSG ONE V1

DSG ONE V1 is a governed AI app-builder and action-runtime control plane.

Core rule:

> No action before plan, gate, approval, runtime evidence, and audit.

The current product focus is the **DSG App Builder Agent Runtime**. A user can lock a goal, generate a PRD and plan, pass the plan gate, approve the runtime handoff, then launch an App Builder orchestration tool that provisions a runtime environment, exposes action-layer tools, writes audit evidence, creates GitHub PR implementation output, and returns a user-visible notification.

---

## Current deployment status

Latest observed Vercel production deployment:

| Field | Value |
|---|---|
| Project | `dsg-one-v1` |
| Deployment state | `READY` |
| Target | `production` |
| Commit | `170c38213bd939aedbf1b8f7b873d8f7d2bce0cf` |
| Commit message | `Switch playground to app builder agent runtime view` |
| Production alias | `https://dsg-one-v1.vercel.app` |

### Truth boundary

`READY` on Vercel proves that the app deployed successfully.

It does **not** by itself prove that the full App Builder runtime is verified end-to-end. Runtime verification still requires a successful live run with Supabase environment variables, GitHub token, DB migration, tool-call audit row, generated PR evidence, and deployment/proof checks.

---

## Claim vocabulary

| Claim | Meaning |
|---|---|
| `PLANNED_ONLY` | PRD/plan exists, but no approved runtime action has occurred. |
| `APPROVED_ONLY` | Plan was approved, but execution evidence is still missing. |
| `ENVIRONMENT_READY` | A runtime environment/manifest exists, but build/deploy proof is not complete. |
| `IMPLEMENTED_UNVERIFIED` | Code/PR evidence exists, but CI/deploy/production proof is still incomplete. |
| `DEPLOYABLE` | Build and deployment gates have passed with evidence. |
| `PRODUCTION_VERIFIED` | Real production-flow proof passed with evidence. |

---

## Product flow

```txt
User goal
  ↓
Goal lock
  ↓
PRD + proposed plan
  ↓
Plan gate
  ↓
Approval
  ↓
Runtime handoff
  ↓
App Builder orchestration tool
  ↓
Runtime environment provisioner
  ↓
Agent action layer
  ↓
Full-stack build tool
  ↓
GitHub PR evidence
  ↓
DB-backed audit
  ↓
Notification/result
```

---

## App Builder tools

### `dsg.app_builder.launch_agent_runtime`

Top-level orchestration tool. It runs only after the plan has passed gate and approval.

Responsibilities:

- verify approved runtime handoff
- provision a real runtime environment
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

## Runtime environment provisioner

The runtime environment provisioner creates a real GitHub branch environment and writes an environment manifest before build execution.

Evidence includes:

- repository
- base branch
- runtime branch
- manifest path
- `planHash`
- `approvalHash`
- allowed tools
- allowed paths
- required secrets

This is environment evidence only. It is not build, deployment, or production proof.

---

## DB-backed audit

Tool calls are written to Supabase through:

```txt
dsg_app_builder_tool_audits
```

The audit row stores:

- app builder job id
- workspace id
- actor id
- tool name
- outcome
- evidence refs
- audit event JSON
- created timestamp

Relevant migration:

```txt
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

Optional for future deploy proof:

```bash
VERCEL_TOKEN=
VERCEL_ORG_ID=
VERCEL_PROJECT_ID=
```

If required runtime variables are missing, the runtime must fail closed instead of falling back to mock data.

---

## Local development

Prerequisites:

- Node.js 20+
- npm
- Supabase project with required migrations applied
- GitHub token with repository write permissions for runtime PR generation

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

Run deterministic DSG verification checks:

```bash
npm run dsg:verify
```

Available DSG scripts:

```bash
npm run dsg:claim-gate
npm run dsg:runtime-check
npm run dsg:typecheck
npm run dsg:production-flow-check
npm run dsg:verify
```

---

## API surface

Key App Builder endpoints:

```txt
POST /api/dsg/app-builder/jobs
POST /api/dsg/app-builder/jobs/:jobId/plan
POST /api/dsg/app-builder/jobs/:jobId/approval
POST /api/dsg/app-builder/jobs/:jobId/runtime-handoff
GET  /api/dsg/app-builder/tools
POST /api/dsg/app-builder/jobs/:jobId/tool-call
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

## Verification checklist before claiming runtime success

Do not claim the App Builder runtime is verified until all evidence exists:

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

- database rows
- GitHub commits/branches/PRs
- Vercel deployment status
- build logs
- migration results
- audit rows
- replay/proof artifacts
- browser-visible status after real execution

If evidence is missing, the UI and API must report a blocked or unverified status rather than implying completion.

---

## Status summary

```txt
DEPLOYED: Vercel production deployment is READY.
IMPLEMENTED: App Builder orchestration tool, environment provisioner, build tool, tool-call route, and DB-backed audit path exist.
NOT YET VERIFIED: A complete live App Builder runtime run has not been proven in this README.
NOT PRODUCTION_VERIFIED: Production-flow proof is still required.
```
