# DSG ONE V1 — Governed App Builder Runtime

> Governed app-builder control plane with user-confirmed API calls, visible evidence boundary, and deployable proof workflow.

![Latest Build](https://img.shields.io/badge/latest--build-PASS-brightgreen)
![Truth Boundary](https://img.shields.io/badge/production--verified-not--claimed-orange)

## Current status

**Last status update:** 2026-05-08 05:56 ICT

Latest guided App Builder flow has been merged. The user can now start with a short idea, let the agent ask follow-up questions, review the generated settings, and confirm before the real App Builder API is called.

```text
Status: GUIDED_APP_BUILDER_BUILD_PASS
Production verified: false
Production alias: https://dsg-one-v1.vercel.app
```

Safe claim right now:

```text
governed app-builder runtime with guided API confirmation flow and latest local build pass evidence
```

Do not claim yet:

```text
PRODUCTION_VERIFIED
latest guided UX deployed to production, unless a fresh vercel --prod result is attached
```

## Latest guided App Builder update

Changed files:

```text
components/guided-app-builder-view.tsx
components/agent-playground-view.tsx
```

Latest commits:

```text
e9b747ea89a22cac6e2a7423d338d420930ccf55  feat: add guided app builder api confirmation
eb6b91566cf37b72b49c8c69f6c8d13514785fc1  feat: route agent playground to guided builder
```

User-facing flow:

```text
User types a short idea, for example Todo
  -> Agent asks follow-up questions
  -> User selects features
  -> User selects style
  -> Agent composes Goal / Success criteria / Constraints in the visible monitor
  -> User reviews the generated settings
  -> User clicks: ยืนยันและเรียก API สร้างแผน
  -> UI calls the real App Builder APIs
```

The confirmation button explicitly says it will call:

```text
POST /api/dsg/app-builder/jobs
POST /api/dsg/app-builder/jobs/:jobId/plan
```

## Latest verification evidence

Verified by operator screenshot after the guided App Builder update:

```text
PASS: npm run build
```

Build output included:

```text
/dsg/app-builder   11.3 kB
[dsg-build] Restored app/globals.css.
[dsg-build] Restored postcss.config.mjs.
```

Observed warning, not a build blocker:

```text
[DEP0190] DeprecationWarning: Passing args to a child process with shell option true...
```

Still required before fresh production deployment claim:

```bash
npm run dsg:typecheck
npm run lint
git diff --check
npm run dsg:product-ready
vercel --prod
```

## Product flow

```text
User chats with App Builder Agent
  -> Agent asks follow-up questions
  -> Agent prepares visible Goal / Success criteria / Constraints
  -> User confirms API call
  -> Goal lock
  -> PRD
  -> Plan gate
  -> Approval
  -> Runtime handoff
  -> App Builder orchestration tool
  -> GitHub branch / PR evidence
  -> DB-backed audit
  -> Product-ready check
  -> Production-flow proof
```

## Main surfaces

```text
/                               Main DSG control plane
/dsg/app-builder                App Builder Console
/dsg/app-builder/[jobId]        Job detail and evidence view
/dsg/app-builder/sandbox        App Builder sandbox
/product-ready                  Product-ready gate UI
/generated-apps/[appId]         Generated app output
/api/dsg/product-ready          Product-ready API
/api/dsg/*                      Runtime, memory, proof, and app-builder APIs
```

## API surface

```text
POST /api/dsg/app-builder/jobs
POST /api/dsg/app-builder/jobs/:jobId/plan
POST /api/dsg/app-builder/jobs/:jobId/approval
POST /api/dsg/app-builder/jobs/:jobId/runtime-handoff
GET  /api/dsg/app-builder/tools
POST /api/dsg/app-builder/jobs/:jobId/tool-call
```

## Truth boundary

The latest proof shows that the guided App Builder update builds locally. It does not prove that the latest guided UX is deployed to production or that every generated workflow is production verified.

Missing proof must stay missing. Mock data, local-only state, browser-only state, or unchecked logs must not be presented as production evidence.

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

## Required environment variables

```bash
DSG_ONE_V1_SUPABASE_URL=
DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY=
GITHUB_TOKEN=
OPENAI_API_KEY=
VERCEL_TOKEN=
VERCEL_ORG_ID=
VERCEL_PROJECT_ID=
DSG_BUILDER_GITHUB_OWNER=tdealer01-crypto
DSG_BUILDER_GITHUB_REPO=dsg-one-v1
DSG_BUILDER_BASE_BRANCH=main
APP_URL=https://dsg-one-v1.vercel.app
```

Do not expose server secrets through `NEXT_PUBLIC_*`.

## Verification commands

```bash
npm run dsg:claim-gate \
&& npm run dsg:runtime-check \
&& npm run dsg:typecheck \
&& npm run lint \
&& npm run dsg:product-ready

npm run build
git diff --check
vercel --prod
```

## Product-ready checklist

- [x] Guided App Builder confirmation flow merged
- [x] Guided App Builder local build passed
- [ ] Guided App Builder rerun: `npm run dsg:typecheck`
- [ ] Guided App Builder rerun: `npm run lint`
- [ ] Guided App Builder rerun: `git diff --check`
- [ ] Guided App Builder rerun: `npm run dsg:product-ready`
- [ ] Guided App Builder deployed after fresh verification
- [ ] Live App Builder runtime run attached
- [ ] GitHub branch / PR evidence attached for a live generated app
- [ ] Supabase audit row attached
- [ ] Deployment proof artifact attached
- [ ] Production-flow proof attached

## Next proof targets

```text
1. Pull latest main.
2. Run typecheck, lint, build, diff check, and product-ready gate.
3. Deploy once after local verification passes.
4. Open production and test the guided App Builder confirmation flow.
5. Run a real App Builder job from the guided UI.
6. Capture runtime handoff evidence.
7. Generate a GitHub branch / PR from runtime.
8. Confirm Supabase audit row evidence.
9. Attach deployment proof artifact.
10. Run production-flow proof.
11. Only then consider PRODUCTION_VERIFIED.
```

## Operator notes

Safe wording:

```text
governed app-builder runtime
guided App Builder confirmation flow
user-confirmed API call before plan generation
latest guided UX local build pass
implementation surface with proof boundary
```

Do not claim:

```text
certified enterprise system
guaranteed compliant
fully autonomous production builder
PRODUCTION_VERIFIED without live proof
latest guided UX deployed without fresh Vercel evidence
```
