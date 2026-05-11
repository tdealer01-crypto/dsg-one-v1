# Enterprise Marketplace Readiness Audit Kit

Date: 2026-05-11
Branch: `enterprise-marketplace-readiness-audit-kit`

## Purpose

This kit turns marketplace readiness into an evidence-gated review instead of a marketing claim.

It follows the uploaded execution baseline:

- verify real files, routes, deployments, and logs before trusting a claim
- keep demo-only work out of the production release path
- mark unverified items as `REVIEW` or `BLOCKED`, never `PASS`
- give the user a visible next action for every blocked state

## Added routes

- `GET /api/dsg/marketplace/readiness`
  - Returns the machine-readable readiness report.
  - Source: `lib/dsg/marketplace/readiness.ts`

- `GET /enterprise/readiness`
  - Customer/operator-facing readiness page.
  - Shows verdict, gate status, verified evidence, required evidence, and next action.

## Added smoke script

```bash
APP_URL=https://your-production-url.example npm run smoke:marketplace-readiness
```

The script fails if:

- `APP_URL` or `DSG_ONE_V1_PRODUCTION_URL` is missing
- URL is not HTTPS
- endpoint does not return JSON
- readiness schema is invalid
- a `PASS` verdict conflicts with blocked gates

## Gate status rules

### PASS

Only allowed when the required evidence is attached and can be traced to a real file, route, test, deployment, or customer-facing page.

### REVIEW

Allowed when there is partial evidence, but the marketplace-ready claim is not fully proven.

### BLOCKED

Required when the evidence does not exist yet.

## Current default verdict

`BLOCKED`

Reason: production deployment and app-builder proof routes exist, but enterprise marketplace readiness still needs proof for:

1. server-side RBAC and organization isolation
2. entitlement, plan, seat, and quota behavior
3. customer-facing Terms, Privacy, Security, Support pages
4. accessibility and QA evidence
5. full get-started smoke test from a fresh account

## No-mock policy

No gate may be marked `PASS` using mock data, localStorage-only state, memory-only stores, guessed metrics, or unverified claims.

## How this fits the release flow

This kit is not the final marketplace submission. It is the review frame that blocks false readiness claims and shows exactly what evidence is missing.

Recommended next PRs:

1. Add customer-facing legal/support pages.
2. Add RBAC/org-isolation negative tests.
3. Add entitlement/quota gate proof.
4. Add accessibility checklist and smoke test evidence.
5. Attach production deployment proof hashes to release notes.
