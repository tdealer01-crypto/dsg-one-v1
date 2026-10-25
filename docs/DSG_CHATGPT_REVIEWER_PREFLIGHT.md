# DSG ONE — ChatGPT Reviewer Preflight (source-only)

## Outcome

`GET /api/dsg/reviewer/preflight` checks the existing DSG ONE v1 Supabase session, confirmed email, exact selected workspace membership with existing role `AUDITOR`, an unexpired purpose-bound `dsg_access_invites` record, and the server-stored Auth0 actor link. It requires a workspace declared for `chatgpt_full_system_review`.

This endpoint never adds an account, creates an invitation, sets a role, provisions a computer, grants a Spacetime MCP route, mints a signed permit, or writes to Production. A `PREFLIGHT_ELIGIBLE` outcome means that identity/invitation prerequisites passed; it does not mean that a current ChatGPT OAuth session is verified or that physical resources are isolated. Both remain `NOT_VERIFIED`. Every result sets `no-store`.

The existing `dsg_reviewer_allowlist` is used for Stripe Marketplace Review and **must not** be reused as ChatGPT authority. Reviewer membership in the owner's Production workspace is forbidden. Never promote an existing Stripe invitation by changing its purpose.

## Implementation boundaries

- All runtime execution stays restricted by the canonical Spacetime Plan → Policy → exact Approval → Provider → Evidence chain.
- A verified user-facing Google/AppDeploy/Supabase login is not by itself a signed ChatGPT MCP authorization.
- The persisted Auth0 identity link is a prerequisite, not a substitute for a fresh Auth0 JWT in the Plugin session.
- `AUDITOR` retains the existing read-only profile. No additional role or permission is introduced.
- The purpose marker on a workspace is **not** evidence of separate machine, filesystem or Cinema browser sessions.
- Fail-closed when the exact DSG Production Supabase URL and server-only key are not configured. Do not use an arbitrary project fallback.
- Do not leak linked Auth0 `sub`, service credentials, JWT, session tokens, or other private identifiers.

## Activation gates (not completed by this PR)

1. Independently verify Production Supabase project URL and service-only key are those of DSG ONE v1; currently connected `dsg-control-plane-dev` is not sufficient evidence of the Production binding.
2. Review and promote the separate DSG ONE v1 Pilot PR #248 only after its CI and required DB binding gates. Its `trial_signups` remains canonical for pilot registration, not AppDeploy `pilot_requests`.
3. Create a physically separate reviewer workspace and device/browser sandbox using the existing authorized provisioning paths. Do not reuse the owner's shared Cinema browser profile.
4. Invite an actual non-owner user into that workspace with role `AUDITOR`, purpose `chatgpt_full_system_review`, status `active`, exact workspace ID and bounded expiry. Do not create a fabricated user.
5. Verify Auth0-to-Supabase subject link via the existing audited user identity process; never forge the link row or infer identity from email alone.
6. Let that user connect to the DSG plugin using their own ChatGPT OAuth flow. The reviewer plugin already has a read-only/full-system isolation-test skill; it is private and not yet accessible to outside reviewers.
7. Run positive: OAuth user binding → discover → compose → sandbox read-only execution → provider result → evidence verify, then verify provider postcondition. Run negative: anonymous, different identity, different workspace, wrong client, expired invite, missing plan, forged plan hash, missing signed approval and replay.
8. Only after verified two-user isolation E2E create a separately reviewed, expiring runtime entitlement for sandbox-only execution. Never change the Production Owner policy as a shortcut.

## Verification

Unit test: `npm test -- tests/dsg/reviewer-preflight.test.ts`.

A separate local Node.js type-stripping test of the pure policy reported 16/16 pass; this is **not** a Next.js build or Production E2E. Follow with full exact-head CI, security review, negative route/API tests, actual reviewer identity login, and independent provider receipts before merging or deploying.

No automated Production promotion from this PR.
