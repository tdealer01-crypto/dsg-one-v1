# Framer + Render Deployment Contract

## Goal

Remove Vercel from the DSG ONE production dependency path while preserving the deterministic backend, protected application routes, audit/evidence flows, MCP gateway, AIMO orchestration, and proof services.

## Production split

- **Framer**: public website, marketing pages, pricing, docs, product explanation, public read-only surfaces.
- **Render (`dsg-one-v1-aimo`)**: Next.js application runtime, API routes, protected `/dsg/*` routes, MCP gateway, authentication-dependent application flows.
- **Cinema Proof Agent / other backend services**: remain separate services and are called by DSG ONE through the existing governed pipeline.

Do not move server secrets, Stripe webhook secrets, internal service tokens, DSG API keys, Z3/Ising execution logic, or privileged mutation logic into Framer client code.

## Current Render origin

`https://dsg-one-v1-aimo.onrender.com`

Required Render variables:

```text
APP_URL=https://dsg-one-v1-aimo.onrender.com
NEXT_PUBLIC_APP_URL=https://dsg-one-v1-aimo.onrender.com
```

The MCP gateway currently resolves its own internal API base URL from `NEXT_PUBLIC_APP_URL` or `APP_URL`. Production must never rely on a Vercel fallback.

## Migration phases

### Phase 1 — safe cutover

1. Publish the public DSG ONE site in Framer.
2. Point public navigation such as **Open App / Build / Dashboard** to the protected Render application URL.
3. Keep login and protected `/dsg/*` pages on Render until cross-origin authentication is deliberately redesigned and tested.
4. Point the public custom domain to Framer only after the Framer site is verified.
5. Keep an explicit application subdomain (for example `app.<domain>`) pointing to Render.

This phase avoids moving authenticated browser sessions across origins and avoids adding permissive CORS to privileged APIs.

### Phase 2 — optional read-only Framer data

Only expose explicitly public, read-only endpoints to Framer. Any endpoint exposed cross-origin must:

- return no secrets or privileged workspace data;
- perform its own authorization if user-specific data is involved;
- use an allowlist for the exact Framer production origin;
- never use `Access-Control-Allow-Origin: *` for authenticated/private APIs;
- reject unsupported origins fail-closed.

### Phase 3 — authenticated frontend migration

Move protected dashboard UI into Framer only if there is a tested authentication design that preserves:

- workspace isolation;
- Supabase/session integrity;
- CSRF protections where applicable;
- deterministic DSG gate/approval semantics;
- server-side secret handling;
- audit/evidence continuity.

Until then, Framer is the public presentation layer and Render is the application/runtime layer.

## Truth and UX rules

- Do not copy hard-coded demo/sample data into Framer and present it as real activity.
- Every public claim must link to or be supported by production evidence.
- A user should be able to understand: what DSG does, where to start, where to see results, what was verified, and what action happened next.
- Prefer one obvious primary CTA from Framer into the governed application rather than duplicating runtime controls in two frontends.

## Cutover checklist

- [x] Render service exists and is connected to `tdealer01-crypto/dsg-one-v1` `main`.
- [x] Render auto-deploy is enabled.
- [x] `APP_URL` points to Render.
- [x] `NEXT_PUBLIC_APP_URL` points to Render.
- [ ] Remove hard-coded Vercel fallback from source.
- [ ] Publish Framer public site.
- [ ] Set Framer production domain.
- [ ] Set Render application subdomain/custom domain if desired.
- [ ] Verify public CTA → Render login/app flow.
- [ ] Verify MCP and AIMO routes no longer depend on Vercel.
- [ ] Verify evidence/proof flows after DNS cutover.
