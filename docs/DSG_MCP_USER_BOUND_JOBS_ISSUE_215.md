# DSG ONE ↔ Spacetime: user-bound App Builder Jobs (Issue #215)

## Status
**STAGED / NOT ACTIVATED.** This endpoint and its tests are not a working ChatGPT MCP route. Do not merge or activate until Spacetime delivers the actual verified end-user OAuth access token via a reviewed, non-model-controlled delegation mechanism.

## Server read boundary
- Dedicated GET /api/dsg/app-builder/jobs/oauth read-only route: no write, approval, runtime, or deploy operations.
- Require Authorization: Bearer <end-user Auth0 JWT>; neither an internal token, x-dsg-api-key, cookie nor model principal can substitute.
- Workspace ID is a user-selected UUID selector, not proof. Verify JWT with JWKS RS256, issuer, audience, signed azp pinned by DSG_SPACETIME_CHATGPT_CLIENT_ID, dsg.use and token lifetime before DB access.
- Verify the subject against the existing dual-authenticated dsg_auth0_identity_links mapping with exact issuer and DSG website client.
- Independently verify membership from dsg_workspace_members for actor + selected workspace before calling existing listAppBuilderJobs.
- Use only repo-scoped server-only Supabase connection; bounded errors, private no-store, no tokens or SQL in responses.

## Spacetime prerequisites (NOT IMPLEMENTED)
1. Bind real independently-verified HTTP OAuth Bearer to the current caller, never generate a credential from model-supplied principal or static service token.
2. Add dedicated read-only token delegation into list_app_builder_jobs adapter, never evidence/payload/logs nor other routes; review process boundary and token lifetime.
3. Require explicit workspace selector bound to request, independently check Supabase membership; never use demo-workspace or a guessed workspace.
4. Pin DSG_SPACETIME_CHATGPT_CLIENT_ID only after independent verification of actual signed azp in live OAuth credential. Fail closed if unavailable or changed.
5. Test forged identity, swapped client, wrong workspace, revoked link, absent membership, missing token, and upstream errors.
6. E2E: governed OAuth caller → Spacetime Plan/Route → verified delegated JWT → DSG ONE Jobs (real rows or truthful empty list) → evidence-chain verification.

## Release policy
- DSG ONE half remains a draft PR until the Spacetime half and cross-repo acceptance are ready.
- No AWS environment or secret changes, no database migrations, no demo jobs, no bypass of Approval Gate.
- Passing CI establishes source/test readiness only, not functioning Production delegation.
