# DSG One Governed Memory API Step 16E

## Status

This PR ports the governed memory repository/API route pattern from the control-plane memory work into `dsg-one-v1`.

This is a development-gated memory foundation. It is not a production auth/RBAC claim.

## Routes

| Route | Method | Permission | Purpose |
|---|---:|---|---|
| `/api/dsg/memory/ingest` | POST | `memory:write` | Store a governed memory event. |
| `/api/dsg/memory/search` | GET | `memory:read` | Search workspace-scoped memories. |
| `/api/dsg/memory/gate` | POST | `memory:gate`, `memory:read` | Evaluate memory safety before use and record retrieval audit. |
| `/api/dsg/memory/context-pack` | POST | `memory:context_pack`, `memory:read` | Build a deterministic context pack from allowed memory. |

## Boundary

Routes fail closed unless:

```text
DSG_ALLOW_DEV_AUTH_HEADERS=true
x-dsg-workspace-id is present
x-dsg-actor-id is present
x-dsg-permissions includes route permission
SUPABASE_SERVICE_ROLE_KEY is configured server-side
```

Every response includes:

```json
{
  "productionReadyClaim": false,
  "memoryMayOverrideEvidence": false
}
```

Memory is context candidate only. It cannot override current evidence, audit, database state, runtime observations, or production claim gates.

## Database

This repo uses Supabase REST through the configured exposed schema. The migration creates `api` schema tables:

```text
api.dsg_memory_events
api.dsg_memory_retrievals
api.dsg_memory_context_packs
```

## Smoke

```bash
APP_URL="https://<preview-or-prod-url>" npm run smoke:memory-api
```

The smoke verifies:

```text
1. ingest returns ok=true and memory.id
2. search returns at least one memory
3. gate returns PASS/REVIEW/BLOCK/UNSUPPORTED
4. context-pack returns contextHash
5. all responses declare productionReadyClaim=false
```

## Correct claim

```text
DEV_ROUTE_SMOKE_PASS = pending until smoke passes
PRODUCTION = false
```

Still not proven:

```text
[ ] Production auth provider binding
[ ] Workspace membership enforcement against DSG RBAC tables
[ ] Audit ledger hash-chain entry for every memory use
[ ] Evidence binding route
[ ] UI panels
[ ] Production traffic safety
```
