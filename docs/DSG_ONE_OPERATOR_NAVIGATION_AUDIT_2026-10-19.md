# DSG ONE — Operator navigation truth audit (2026-10-19)

## Decision

Use **one primary operator route**: `/dsg/workroom` (gateway to the existing
AWS operator surface), with `/dsg/app-builder` for app creation and
`/dsg/approvals` for pending human decisions.

`/dsg/autonomous-level` is a capability/evidence **report**, not an
execution console. `/dsg/governance` is reference/audit information.

These routes have source implementations in this repository, but this UI
classification does **not** prove provider E2E or owner-session usability.

## Source-audited user-facing routes

| Route | Role | Source observation | Readiness |
|---|---|---|---|
| `/dsg/workroom` | Operator workspace | Includes workroom status and links to AWS `/control/`, and Cinema | SOURCE_FOUND; LIVE_E2E_NOT_VERIFIED |
| `/dsg/app-builder` | Build/plan workspace | Has app-builder workspace, templates and proof panels | SOURCE_FOUND; FULL_BUILD_DEPLOY_E2E_NOT_VERIFIED |
| `/dsg/approvals` | Human approval | Auth0 approval page; PR #227 released earlier | DEPLOYED; LIVE_APPROVAL_E2E_NOT_VERIFIED |
| `/dsg/autonomous-level` | Readiness report | Calls `evaluateDsgAutonomousLevelGate()` | STATUS_ONLY |
| `/dsg/governance` | Reference | CCVS control catalog | REFERENCE_ONLY |
| `/dsg/action-layer` | Agent Nexus / Telemetry | Shows orchestrator snapshot; not a genuine My Apps catalog | NOT_MY_APPS |
| `/dsg/history` | Example timeline | Contains `MOCK_BUILDS` | SAMPLE_NOT_PRODUCTION |
| `/dsg/analytics` | Example metrics | Contains static build/provider sample records | SAMPLE_NOT_PRODUCTION |
| `/dsg/notifications` | Notifications UI | Repo AGENTS.md states associated API is mock | SAMPLE_NOT_PRODUCTION |
| `/dsg/flow-studio` | Planning interface | Includes a legacy Vercel sample action | SECONDARY_REVIEW |
| `/dsg/templates`, `/dsg/api-keys`, `/dsg/settings` | Secondary utilities | Present in repository | NOT_LIVE_VERIFIED |

## AppDeploy is not a second AWS authority

AppDeploy account lists 8 deployed/ready apps at audit time. AppDeploy
deployed/ready means the app build is served; it does not prove its DSG
provider execution works:

- `dsg-one-public-recovery-g35ayy`: recovery/access workspace. Backend
  references `https://dsg.pics/control` and has an app-scoped workroom
  bridge secret name configured; real AWS authenticated execution is unverified.
- `dsg-exact-mcp-runtime-wniyu0`: deterministic `dsg_exact_select` tool;
  does not mutate AWS.
- `dsg-spacetime-ir4a2m`, `dsg-one-private-briefing-gip5su`,
  `dsg-one-3d-architecture-sio3tq`: source-linked reference/briefing pages.
- `dsg-scientific-discovery-engine-v3-1ucbdj`: its source explicitly reports
  Plan/Approval `LOCKED`; its public check does not authenticate execution.
- `dsg-unified-data-monitoring-nnlke4`: old monitoring snapshot retains
  retired control-plane repository references and has no bound backend secrets
  in the checked AppDeploy app; not the AWS execution authority.
- `ai-project-readiness-check-f4psgp`: separate general-purpose checklist.

Do not delete apps, change domains or replace AWS endpoints as part of
a navigation-only cleanup. Do not present sample analytics or mock history
as real production success.

## UI change and acceptance

- Main sidebar: **one primary page, "คุยกับ DSG ONE" (/dsg/workroom)**.
- Workroom displays a natural-language conversation and a separate list of
  persisted jobs returned from `GET /api/dsg/jobs`. The composer remains
  interactive while multiple independent chat responses or job submissions
  are pending.
- Sending a chat calls the existing `POST /api/dsg/agent-chat` backend.
- "มอบหมายเป็นงาน" creates a durable work item with `POST /api/dsg/jobs`.
  The job list refreshes every 10 seconds without interrupting conversation.
- **Important technical gap:** Creating a durable job is not automatically
  dispatching an AWS provider. Existing job creation persists a goal but
  does not by itself prove plan/execute/evidence. Never claim automatic
  execution until a verified dispatcher, worker and provider receipt exist.
- The separate technical Workroom, App Builder, Approvals, Governance and
  system reporting pages remain reachable under a collapsed operator menu.
  Sample History/Analytics are labeled as sample, never production.
- No extra approval, authentication credential, or Auth0 login is added.
  Actual AWS execution and approval policy remain unchanged.

Run:
```bash
npx vitest run tests/dsg/sidebar-touch-navigation.test.ts tests/dsg/conversational-workroom-ux.test.ts
npm run dsg:typecheck
npm run lint
```

**Truth labels:** SOURCE_CHANGED once PR is updated; TESTED only after the
actual CI step succeeds; DEPLOYED only after AWS exact-source build, security
scan, Ship and public SHA readback; LIVE_E2E only when owner operations and
provider evidence are actually observed.
