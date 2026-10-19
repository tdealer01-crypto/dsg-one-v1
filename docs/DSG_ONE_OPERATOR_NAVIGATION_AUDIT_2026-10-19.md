# DSG ONE — User-first UX and route truth audit (2026-10-19)

## Goal

A nontechnical customer sees a single natural-language conversation:
**สั่งงาน → เอเจนต์ตอบ → ติดตามผล**. They can keep chatting or enqueue
another request without waiting for any earlier reply. Backend plans, policies,
approval receipts, route names and evidence remain internal unless their
attention or troubleshooting is genuinely needed.

The main route is `/dsg/workroom`. This branch introduces
`DsgOperatorChat` and hides legacy operators behind an optional,
on-demand section. The app's other routes remain available.

## Actual user-facing routes

Use readiness states **PASS**, **REVIEW**, **BLOCKED**. A source
implementation is not a production E2E proof.

| Route / function | Verified source observation | Readiness | nextAction |
|---|---|---|---|
| `/dsg/workroom` conversational UI | `DsgOperatorChat` calls the existing authenticated `/api/dsg/agent-chat` and lists durable `/api/dsg/jobs` | REVIEW | Deploy current source, test real owner chat and confirm backend session |
| Multiple conversations | Each chat reply has an independent pending state; composer does not globally lock | REVIEW | Verify 2 simultaneous live replies, out-of-order completion, and continuity on Android |
| Work requests | Explicit natural-language directives submit a durable job through the authenticated `POST /api/dsg/jobs` API; creation does not start AWS execution | REVIEW | Integrate and E2E-test an actual AWS worker/dispatcher, plan, provider execution and signed evidence |
| Task results | UI polls real `GET /api/dsg/jobs`; a completion report is distinguished from a bare completed state | REVIEW | Verify a real completed job with linked evidence |
| `/dsg/approvals` | Dedicated Auth0 approval page; merged PR #227 and verified AWS Ship previously | REVIEW | Test a real human-approved request and evidence chain |
| `/dsg/app-builder` | Builder UI, templates and proof panels exist | REVIEW | Verify real end-to-end build/deploy against AWS |
| `/dsg/autonomous-level` | Capability report from `evaluateDsgAutonomousLevelGate` | PASS | Keep marked report-only; no user-facing execute claims |
| `/dsg/governance` | Control catalog UI exists | PASS | Keep under advanced |
| `/dsg/action-layer` | Agent Nexus / Telemetry snapshot, not a genuine My Apps catalog | REVIEW | Wire real app listing before using the My Apps label |
| `/dsg/history` | `MOCK_BUILDS` fixtures and explicit sample warning | REVIEW | Replace fixtures with verified database/job history |
| `/dsg/analytics` | Static chart and cost numbers, explicitly marked sample | REVIEW | Replace with real authenticated metrics before production claims |
| `/dsg/notifications` | UI renders static fixture data; backend `GET/PATCH /api/dsg/notifications` already queries `dsg_notifications` | REVIEW | Connect existing live API to UI; do not rebuild it |
| `/dsg/flow-studio` | Planner UI retains Vercel-era example | REVIEW | Use current AWS endpoints/route catalog |
| `/dsg/settings` | No page implementation found; old sidebar target invalid | BLOCKED | Do not link to missing route; link account/workspace to existing `/dsg/access` |
| `/dsg/access` | Existing session/workspace access route referenced by current Workroom | REVIEW | Verify owner navigation after deployment |

## Data provenance and limits

- Chat response endpoint: `POST /api/dsg/agent-chat` (authenticated user,
  stored memory when configured, provider fallback explicitly reported).
- Durable job creation: `POST /api/dsg/jobs`, workspace-scoped
  `dsg_create_runtime_job` RPC. **Not execution.**
- Task readback: `GET /api/dsg/jobs`, workspace-scoped Supabase records.
  A job's reported status is not fabricated client progress.
- No additional Auth0 application, owner approval layer, secret,
  anonymous executor, or alternate control plane is introduced.
- On workroom route no global sidebar/mobile admin drawer. Advanced existing
  Workroom, Cinema and technical panels mount only if explicitly opened.
- Existing AWS Governance remains authoritative. This UI change cannot
  claim provider execution without a worker event and signed evidence.

## AppDeploy classification

Eight deployed AppDeploy apps were observed at inspection time. Their READY
status verifies deployment, not governed AWS execution.

- `dsg-one-public-recovery-g35ayy`: external access/workroom bridge; its
  app-scoped `DSG_WORKROOM_ACCESS_KEY` secret name exists but real AWS
  owner-scoped action E2E was not verified.
- `dsg-exact-mcp-runtime-wniyu0`: deterministic read-only
  `dsg_exact_select` MCP.
- `dsg-spacetime-ir4a2m`, `dsg-one-private-briefing-gip5su`,
  `dsg-one-3d-architecture-sio3tq`: reference/briefing surfaces.
- `dsg-scientific-discovery-engine-v3-1ucbdj`: its source reports
  Plan/Approval LOCKED and does not execute them.
- `dsg-unified-data-monitoring-nnlke4`: old observer that still references
  a retired control-plane repo; it is not AWS Spacetime execution authority.
- `ai-project-readiness-check-f4psgp`: unrelated checklist.

No AppDeploy app is deleted or reconfigured by this PR. AWS remains runtime
authority; the AppDeploy account is separate.

## Acceptance

```bash
npx vitest run tests/dsg/sidebar-touch-navigation.test.ts tests/dsg/operator-chat-first.test.ts
npm run dsg:typecheck
npm run lint
```

For production, accept only exact-head CI, immutable image build + ECR scan,
Ship success, serving SHA verification and a real owner session test.
`SOURCE_CHANGED`, `TESTED`, `DEPLOYED`, `LIVE_E2E` are
separate milestones and must not be conflated.
