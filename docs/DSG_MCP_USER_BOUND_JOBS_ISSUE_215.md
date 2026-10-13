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

## Verified staging (not production activation)
- The purpose-specific keypair already exists in the two stage-only SSM paths. Private runtime PR #689 merged at 467fdbeb18859831a68a9522aea5979b3dfc5b2b. Do not recreate the IAM role or keys.
- Public Ed25519 fingerprint (SHA-256): 0104e394520ee253a683826ceb2a6e4d3a01b058c5af17d4a08e21f976770f71. Production containers have not been wired by this work.

## Pending before Merge / Production
1. Owner-gated distribution and pinning of the existing staged keys; no keys stored in repository.
2. Actual signed ChatGPT azp verification and server configuration; no guessed OAuth client.
3. Exact-head CI for both repositories, cross-language test vector and independent Security Review.
4. Replay protection source now consumes a SHA-256 hash of issuer/jti via the service-role-only consume_dsg_jobs_delegation RPC after signature/link/membership verification. The unique primary key arbitrates across replicas. Repeated receipts return 409; missing/unavailable/malformed RPC returns bounded 503 and no Jobs read. There is no consume retry, including uncertain writes. A failed Jobs read leaves the receipt spent; obtain a fresh governed execution. Apply the included migration only through the coordinated activation gate. Require exact-head CI including real PostgreSQL concurrent-session tests and independent security review; local tests do not prove production enforcement.
5. Controlled coordinated deployment with rollback; signed-in workspace read + wrong workspace / forged principal / wrong client negative checks and Evidence Chain.

**Truth boundary:** CI proves source tests only. Production remains unchanged until activation and E2E evidence pass.


## Source-only release guard (2026-10-13)

`list_app_builder_jobs` via the website MCP bridge is **disabled by default**.
Only an explicitly configured `DSG_SPACETIME_JOBS_DELEGATION_ACTIVE=true`
after the separate, owner-gated coordinated rollout enables the new route.
Absent/off returns `DSG_MCP_JOBS_DELEGATION_NOT_ACTIVE` without falling back
to a static service token or claiming production readiness. The flag itself
does not bypass Ed25519 verification, OAuth issuer/client binding, replay
consume or the workspace membership check.

All three sequential identity-link, membership and replay-store requests
use explicit 5-second request timeouts and fail closed on a timeout.
No uncertain replay consume is retried.

Review findings, both exact-head CIs, production key/client readbacks,
database migration and rollback readiness, and signed-in positive/negative
E2E must pass before enabling this flag. No source-only PR is authority to
deploy or mutate production credentials. Existing stage keys must be reused.
