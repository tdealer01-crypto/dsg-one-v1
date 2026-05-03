# DSG Deployment Verification

This document records the deployment verification boundary for `dsg-one-v1`.

## Vercel Project

- Project: `dsg-one-v1`
- Project id: `prj_f6nIx3bZKMiw3y1q81m2YdzAtoQH`
- Team: `tdealer01-cryptos-projects`

## Required repo-scoped environment variables

Use these variables only for the `dsg-one-v1` Vercel project:

```bash
DSG_ONE_V1_SUPABASE_URL=https://zeyguilldygozufpgxms.supabase.co
DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY=<server-only-secret>
NEXT_PUBLIC_DSG_ONE_V1_SUPABASE_URL=https://zeyguilldygozufpgxms.supabase.co
NEXT_PUBLIC_DSG_ONE_V1_SUPABASE_PUBLISHABLE_KEY=sb_publishable__T5uR3y1_EH6cDabodIEwA_Vads9ni4
```

Do not use shared Supabase environment variable names for this repo.

## Verification rule

Production remains blocked until Vercel shows a `main` deployment with `target = production`, `state = READY`, and the latest GitHub commit SHA.
