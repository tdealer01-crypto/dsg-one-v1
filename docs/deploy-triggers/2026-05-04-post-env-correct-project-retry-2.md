# Post-env correct project deployment retry

> Historical record (2026-05-04). The Vercel deployment it refers to is retired; production is AWS-only. Do not use this as a deploy procedure.

This commit retries production deployment after `DSG_ALLOW_DEV_AUTH_HEADERS` was confirmed on the correct Vercel project `dsg-one-v1`.

Expected smoke after READY:

```bash
APP_URL="<verified AWS origin>" npm run smoke:memory-api
```

Claim boundary remains `DEV_ROUTE_SMOKE_ONLY`; this is not production auth/RBAC.
