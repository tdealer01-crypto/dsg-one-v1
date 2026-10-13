# DSG ONE ↔ Spacetime App Builder Jobs — Issue #215

## DRAFT / NOT DEPLOYED
DSG ONE PR #217 depends on DSG-Private-Production-Runtime PR #681. No claim of working authenticated Production Jobs read.

## Exact read-only delegation protocol
- The incoming ChatGPT OAuth access token is verified by Spacetime only for https://aws.dsg.pics. It must never be forwarded as a DSG ONE API Bearer.
- Spacetime separately signs a 25-second Ed25519 JWT with exact issuer urn:dsg:spacetime:jobs-delegation and audience https://dsg.pics/api/dsg/app-builder/jobs/oauth.
- The DSG ONE read-only endpoint receives that signed assertion as Bearer and the selected Workspace UUID via x-dsg-workspace-id. A service token, cookie, actor-role header or unsigned JWT is not an identity.
- DSG ONE verifies the pinned public key from DSG_SPACETIME_JOBS_DELEGATION_PUBLIC_KEY_B64; exact client azp from DSG_SPACETIME_CHATGPT_CLIENT_ID; subject, scope dsg.jobs.read, route, plan_id, plan_hash, decision_hash, selected workspace UUID, ALLOW verdict and iat/nbf/exp <= 30 seconds.
- After cryptographic verification, require preexisting Auth0-to-website actor link (via Auth0 website client) and workspace membership in Supabase; use existing read-only scoped Jobs repository.
- Never bypass approvals or allow Create/Execute/Deploy from this token.

## Pending before Merge / Production
1. Independent key generation, server-side private/public key distribution and pinning; no keys stored in repository.
2. Actual signed ChatGPT azp verification and server configuration; no guessed OAuth client.
3. Exact-head CI for both repositories, cross-language test vector and independent Security Review.
4. Replay-risk review: signed random jti alone is not proof of one-time use; 25-second expiry bounds but does not eliminate replay.
5. Controlled coordinated deployment with rollback; signed-in workspace read + wrong workspace / forged principal / wrong client negative checks and Evidence Chain.

**Truth boundary:** CI proves source tests only. Production remains unchanged until activation and E2E evidence pass.
