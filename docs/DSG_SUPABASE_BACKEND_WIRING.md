# DSG Supabase Backend Wiring

## Purpose
This document lists the runtime environment variables and backend routes needed for the DSG backend to call Supabase RPC as the database source-of-truth.

## Required server environment
Do not expose service-role values to the browser.

```bash
DSG_SUPABASE_URL=https://<project-ref>.supabase.co
DSG_SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>
```

The API caller must also provide a real user access token:

```http
Authorization: Bearer <supabase-user-jwt>
x-dsg-actor-id: <auth-user-id>
x-dsg-workspace-id: <workspace-uuid>
x-dsg-actor-role: OWNER|ADMIN|OPERATOR|AUDITOR|VIEWER
```

Header role is still a dev bridge. Production must replace this with server-verified auth/RBAC context.

## Wired routes
| Route | Method | RPC | Status |
|---|---:|---|---|
| `/api/dsg/workspaces` | POST | `dsg_create_workspace` | wired |
| `/api/dsg/jobs` | POST | `dsg_create_runtime_job` | wired |
| `/api/dsg/jobs/[jobId]/evidence` | POST | `dsg_record_evidence` | wired |
| `/api/dsg/jobs/[jobId]/replay` | POST | `dsg_record_replay_proof` | wired |
| `/api/dsg/jobs` | GET | none | pending database list query |

## Truth boundary
This wiring moves write paths from scaffold to Supabase RPC. It still does not prove production readiness. Production remains blocked until server-side auth provider verification, audit export, replay verification, deployment proof, and production user-flow proof exist.
