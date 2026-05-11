# DSG ONE V1 — Autonomous Governed Runtime

DSG ONE V1 is a governed app-builder and autonomous runtime control plane.

Production alias: `https://dsg-one-v1.vercel.app`

## Current status

Last verified: **2026-05-11 ICT**

```text
System claim: DSG_AUTONOMOUS_LEVEL_COMPLETE
Completion: true
Passed required lanes: 9/9
Marketplace readiness: REVIEW
Audit packet final verdict: BLOCKED
Production-ready marketplace claim: false
```

## Production smoke evidence

```text
build:termux: PASS
smoke:first-value-flow: PASS, failures: []
smoke:audit-packet: PASS, status: 200, ok: true
smoke:marketplace-readiness: PASS endpoint/schema, verdict: REVIEW
smoke:accessibility-qa: PASS endpoint/schema, internal verdict: BLOCKED
smoke:security-rbac: PASS endpoint/schema, internal verdict: BLOCKED
smoke:entitlement: PASS endpoint/schema, internal verdict: BLOCKED
smoke:app-builder-flow-proof: PASS fail-closed, productionReadyClaim: false
```

## Marketplace evidence boundary

The marketplace readiness surface is intentionally evidence-first and fail-closed.

```text
/api/dsg/marketplace/readiness
verdict: REVIEW
gates: 6
pass: 0
review: 6
blocked: 0
noMockPolicy.enforced: true
```

```text
/api/dsg/marketplace/audit-packet
status: 200
ok: true
finalVerdict: BLOCKED
missingEvidenceCount: 65
failures: []
```

`REVIEW` and `BLOCKED` are the correct states until real enforcement, accessibility review, owner approval, and deployment evidence are attached.

This README does **not** claim marketplace PASS, production-ready status, completed RBAC enforcement, completed entitlement enforcement, WCAG approval, or owner approval completion.

## Runtime surface

```text
/dsg/app-builder
/api/dsg/app-builder/outcome
/enterprise/readiness
/enterprise/accessibility
/enterprise/market
/enterprise/terms
/enterprise/privacy
/enterprise/security
/enterprise/support
/enterprise/entitlement
/enterprise/security-rbac
/api/dsg/market/agent-app-builder
/api/dsg/marketplace/readiness
/api/dsg/marketplace/readiness-score
/api/dsg/marketplace/audit-packet
/api/dsg/marketplace/accessibility-qa
/api/dsg/marketplace/security-rbac
/api/dsg/marketplace/entitlement
/dsg/flow-studio
/api/dsg/flow-studio/config
/dsg/autonomous-level
/api/dsg/autonomous-level/status
```

## Production verification

```bash
export APP_URL="https://dsg-one-v1.vercel.app"

npm run smoke:first-value-flow
npm run smoke:audit-packet
npm run smoke:marketplace-readiness
npm run smoke:accessibility-qa
npm run smoke:security-rbac
npm run smoke:entitlement
npm run smoke:app-builder-flow-proof
```

## Claim ladder

```text
DSG_AUTONOMOUS_LEVEL_COMPLETE: current
MARKETPLACE_REVIEW_READY: current evidence-first review state
MARKETPLACE_PASS: locked until full enforcement, review, and approval evidence exists
```

## Next upgrade

```text
1. Add server-side RBAC enforcement tests and cross-org denial tests.
2. Add entitlement or billing provider proof, quota denial tests, and upgrade-path proof.
3. Add accessibility review notes for keyboard, semantics, contrast, mobile viewport, and status readability.
4. Add owner approvals and convert only proven gates from REVIEW/BLOCKED to PASS.
```