# AGI DSG Runtime Route Map

## Purpose
Map intended runtime surfaces before production implementation. A route is not production-valid until it is backed by server-side auth, repository persistence, audit, evidence, and replay checks.

## UI Routes
| Route | Purpose | Current Status | Production Claim |
|---|---|---:|---:|
| `/agi` | AGI/DSG control overview and claim gate explanation | Static buildable page | No |

## Planned API Routes
| Route | Method | Permission | Purpose | Required Tables |
|---|---:|---|---|---|
| `/api/dsg/jobs` | GET/POST | `job:read`, `job:create` | list/create runtime jobs | `dsg_runtime_jobs` |
| `/api/dsg/jobs/[jobId]` | GET | `job:read` | read job state | `dsg_runtime_jobs`, `dsg_runtime_events` |
| `/api/dsg/jobs/[jobId]/plan` | POST | `job:plan` | create deterministic DAG/wave plan | `dsg_task_plans`, `dsg_wave_plans` |
| `/api/dsg/jobs/[jobId]/controls` | POST | `job:control` | pause/resume/kill | `dsg_runtime_events`, `dsg_audit_ledger` |
| `/api/dsg/jobs/[jobId]/approvals` | POST | `approval:write` | approve/reject high-risk steps | `dsg_approvals` |
| `/api/dsg/jobs/[jobId]/evidence` | GET/POST | `evidence:read/write` | read/write evidence items | `dsg_evidence_items` |
| `/api/dsg/jobs/[jobId]/audit/export` | POST | `audit:export` | export audit ledger | `dsg_audit_exports` |
| `/api/dsg/jobs/[jobId]/replay` | POST | `replay:verify` | verify replay proof | `dsg_replay_proofs` |
| `/api/dsg/jobs/[jobId]/completion` | POST | `job:complete` | claim completion only after gates pass | all proof tables |
| `/api/dsg/connectors/openapi/import` | POST | `connector:create` | import OpenAPI as governed tools | `dsg_connectors`, `dsg_tool_registry` |
| `/api/dsg/deployment-proofs` | POST | `deployment:write` | record deployment evidence | `dsg_deployment_proofs` |
| `/api/dsg/production-flow-proofs` | POST | `production:write` | record real user-flow proof | `dsg_production_flow_proofs` |

## Fail-Closed Rule
Every planned API route must reject when any required context is missing: authenticated actor, workspace membership, permission, persisted job, evidence path, audit path, or replay path.
