# DSG ONE — Owner approval without duplicate website login

## Problem

The human approval page previously fetched `/api/dsg/identity/link` and required
a Supabase website session **before** creating the dedicated Auth0 approver client.
A missing/expired site session prevented Auth0 redirect callbacks from being processed
and left the owner repeating sign-in steps.

## Change

- `/dsg/approvals` initializes and completes the dedicated Auth0 approver
  login/redirect independently of the site session.
- `/api/dsg/spacetime/user-tools` accepts the three human-approval tools with
  a verified, **approve-only** Auth0 JWT instead of requiring a second Supabase
  website session and identity-link lookup.
- The Auth0 verifier still pins RS256, issuer, audience, token expiry, the dedicated
  approver `azp`, and `dsg.approve` scope.
- Only `spacetime_list_pending_approvals`, `spacetime_get_approval`, and
  `spacetime_resolve_approval` use this route.
- The same user-supplied access token is forwarded to **AWS Spacetime**, which
  independently enforces approval ownership, exact request view, signed MFA
  for high-risk actions, audit and permit issuance.
- Agent `dsg.use` tools (including `spacetime_execute`) still require
  website actor/workspace authorization, subject binding and AWS checks.

## Not changed

No public anonymous approval, no new Alpic gate, no service key fallback,
no change to AWS consent or execution policies, no automatic approval.
One approval per plan is **not** implemented by this patch; AWS still uses
exact-request permits for affected routes. This fix addresses duplicate
sign-in on the existing owner approval path, not authorization for every
tool or provider health.

## Acceptance

Run:
```bash
npm test -- tests/dsg/approval-client-stepup.test.ts tests/dsg/user-bound-auth0-spacetime-bridge.test.ts
npm run dsg:typecheck
```

Use a real Auth0 approver session on `https://dsg.pics/dsg/approvals`
to verify an existing pending request without any Supabase sign-in.
Do not report production E2E PASS until deployed and a real request
has a matching AWS approval event and signed execution evidence.

## Verification labels

- SOURCE_CHANGED: yes
- TEST_SOURCE_ADDED: yes
- CI_PASS: pending
- PRODUCTION_DEPLOYED: not performed by this change
- OWNER_APPROVAL_LIVE_E2E: pending
