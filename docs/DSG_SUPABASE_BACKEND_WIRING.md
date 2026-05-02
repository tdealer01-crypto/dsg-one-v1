# DSG Supabase Backend Wiring

## Purpose
This document lists the runtime environment variables and backend routes needed for the DSG backend to call Supabase RPC as the database source-of-truth.

## Required server environment
Do not expose service-role values to the browser. This repo must use repo-scoped names so it does not collide with another repository or Vercel project.

```bash
DSG_ONE_V1_SUPABASE_URL=https://<project-ref>.supabase.co
DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>
```

Optional public values can use the same repo prefix:

```bash
NEXT_PUBLIC_DSG_ONE_V1_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_DSG_ONE_V1_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

The API caller must provide a real Supabase user access token and workspace id:

```http
Authorization: Bearer <supabase-user-jwt>
x-dsg-workspace-id: <workspace-uuid>
```

The server verifies the JWT by calling Supabase Auth `/auth/v1/user`, then resolves the actor role from `dsg_workspace_members`. `x-dsg-actor-id` and `x-dsg-actor-role` are not trusted by default. A legacy dev bridge only works when `DSG_ALLOW_DEV_HEADER_ACTOR=true`, and must not be enabled for production.

## Vercel isolation rule
Set these variables only on the Vercel project for `tdealer01-crypto/dsg-one-v1`. Do not copy generic `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, or shared `SUPABASE_SERVICE_ROLE_KEY` values from another repo.

## Wired routes
| Route | Method | RPC | Status |
|---|---:|---|---|
| `/api/dsg/workspaces` | POST | `dsg_create_workspace` | wired |
| `/api/dsg/jobs` | POST | `dsg_create_runtime_job` | wired |
| `/api/dsg/jobs/[jobId]/plan` | POST | `dsg_create_plan` | wired |
| `/api/dsg/jobs/[jobId]/evidence` | POST | `dsg_record_evidence` | wired |
| `/api/dsg/jobs/[jobId]/evidence/manifest` | POST | `dsg_create_evidence_manifest` | wired |
| `/api/dsg/jobs/[jobId]/replay` | POST | `dsg_record_replay_proof` | wired |
| `/api/dsg/jobs/[jobId]/audit/export` | POST | `dsg_create_audit_export` | wired |
| `/api/dsg/jobs/[jobId]/deployment-proof` | POST | `dsg_record_deployment_proof` | wired |
| `/api/dsg/jobs/[jobId]/production-flow-proof` | POST | `dsg_record_production_flow_proof` | wired |
| `/api/dsg/jobs/[jobId]/completion` | POST | `dsg_create_completion_report` | wired |
| `/api/dsg/jobs` | GET | none | pending database list query |

## Truth boundary
This wiring moves write paths from scaffold to Supabase RPC, replaces header-role trust with server verification, and now requires repo-scoped Supabase env names. It still does not prove production readiness until CI/local verification, deployment proof, and production user-flow proof are observed.
