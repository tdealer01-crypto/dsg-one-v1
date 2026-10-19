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

- Main sidebar: **Workroom, App Builder, Approvals**.
- Secondary reporting: **Autonomous Level (report), Governance (reference)**.
- A collapsed advanced group retains existing URLs for templates, planner,
  Agent Nexus, API keys and clearly labeled **sample** history/analytics/
  notifications.
- Autonomous Level page explains it is not an execution entry point and
  links to the three real workflows.
- No extra approval or Auth0 login layer has been added.

Run:
```bash
npx vitest run tests/dsg/sidebar-touch-navigation.test.ts
npm run dsg:typecheck
npm run lint
```

**Truth labels:** SOURCE_CHANGED once PR is updated; TESTED only after the
actual CI step succeeds; DEPLOYED only after AWS exact-source build, security
scan, Ship and public SHA readback; LIVE_E2E only when owner operations and
provider evidence are actually observed.
