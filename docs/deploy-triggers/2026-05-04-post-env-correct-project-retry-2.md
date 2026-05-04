# Post-env correct project deployment retry

This commit retries production deployment after `DSG_ALLOW_DEV_AUTH_HEADERS` was confirmed on the correct Vercel project `dsg-one-v1`.

Expected smoke after READY:

```bash
APP_URL="https://dsg-one-v1.vercel.app" npm run smoke:memory-api
```

Claim boundary remains `DEV_ROUTE_SMOKE_ONLY`; this is not production auth/RBAC.
