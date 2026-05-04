# DSG Memory Smoke Env Status

This file records the current blocker for the governed memory smoke route.

## Current blocker

The memory API route is deployed and reachable, but the production runtime still returns:

```text
DSG_DEV_AUTH_HEADERS_DISABLED
```

That means the deployed runtime does not currently see:

```text
DSG_ALLOW_DEV_AUTH_HEADERS=true
```

## Correct boundary

This flag is only for the development-header smoke path. It is not production auth/RBAC.

The memory route remains bounded by:

```text
productionReadyClaim=false
claimStatus=DEV_ROUTE_SMOKE_ONLY
memoryMayOverrideEvidence=false
trustBoundary=development-header-context
```

## Required proof before claiming pass

The smoke can only be claimed after:

```text
APP_URL=https://dsg-one-v1.vercel.app npm run smoke:memory-api
```

returns:

```text
PASS: DSG One governed memory API smoke completed
```

Until then, the correct status is:

```text
MEMORY_API_DEPLOYED
MEMORY_DB_SCHEMA_READY
DEV_ROUTE_SMOKE_BLOCKED_BY_ENV
PRODUCTION=false
```
