# AGI DSG Operator Runbook

## Operator Principle
The operator controls the runtime. The model never claims production success by itself. Every high-risk or external mutation must be visible, permissioned, auditable, and reversible where possible.

## Before Running Any AGI/DSG Flow
1. Confirm the active workspace.
2. Confirm authenticated actor and server-side role.
3. Confirm the goal lock and input hash.
4. Confirm tool registry and connector risk levels.
5. Confirm no production claim is enabled from mock/dev/smoke data.

## Stop Conditions
Stop or block the job immediately when:
- Evidence is missing.
- Audit export is missing.
- Replay proof is missing.
- Deployment proof is missing for deployability claims.
- Production user-flow proof is missing for production claims.
- The runtime source-of-truth is memory, localStorage, fixture, test data, or mock data.
- A role or permission is supplied only by client headers.
- An external system returns inconsistent, stale, unauthorized, or unverifiable data.

## Claim Decision Table
| Situation | Allowed Claim |
|---|---|
| Files exist but no tests | Implemented only |
| Tests pass but no deployment proof | Verified only |
| Deployment URL verified but no real user flow | Deployable only |
| Real user flow exists but no audit/replay | Blocked |
| Evidence + audit + replay + deployment + auth/RBAC + real user flow pass | Production claim allowed |

## Incident Handling
- Record the job id, actor id, workspace id, route, tool name, risk level, decision, and evidence ids.
- Freeze further production claims for the affected workspace.
- Export the audit ledger.
- Re-run replay verification.
- Do not overwrite evidence. Append a corrective evidence item.

## Local Check
Run:

```bash
node scripts/dsg-claim-gate-check.mjs
```

This static check only verifies that required guard files exist and that the repository does not contain obvious production claims without proof markers. It is not a replacement for typecheck, tests, deployment verification, or production proof.
