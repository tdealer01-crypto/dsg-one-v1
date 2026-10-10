# User-bound Auth0 → AWS Spacetime — scoped implementation (2026-10-10)

## Reused production infrastructure

- `/dsg/autonomous-level` and `/api/dsg/identity/link` already perform double-authenticated account linking: DSG ONE Supabase actor/workspace and Auth0 PKCE JWT (issuer, audience, authorized party and `dsg.use`).
- `public.dsg_auth0_identity_links` already persists the unique actor ↔ Auth0 subject mapping. Its RLS forbids direct `anon`/`authenticated` access.
- `https://aws.dsg.pics/mcp` remains the single governance, approval, execution and evidence authority.
- No replacement MCP, no new Auth0 client or shared owner credential.

## New live user credential bridge

`POST /api/dsg/spacetime/user-tools` is an explicit user-session MCP call gateway. Before *any* AWS RPC:

1. Require exact DSG website Origin and bounded JSON.
2. Independently re-check Supabase website actor + current workspace membership.
3. Check role-based permission appropriate for each tool.
4. Verify a **user-presented Auth0 access token** using existing RS256 JWKS, exact issuer/audience, `azp`, lifetime, and `dsg.use`.
5. Re-read the persisted actor ↔ Auth0 subject mapping using the backend service role for *lookup only*, never as an AWS MCP credential.
6. Enforce `oauth:<verified-sub>` on plan participants and executable/approval request agents. Allow only known tools; explicitly **refuse** `spacetime_resolve_approval` until AWS can attribute a genuine user-specific approval authority rather than the existing generic customer principal.
7. Send **only the user's Auth0 Bearer** to the fixed public AWS MCP. Fail closed on upstream 401, errors, or missing structured receipt.
8. Return source receipts and `userPrincipalVerified`. This is not `VERIFIED_COMPLETED` without real provider postcondition and valid evidence.

Access token stays in the existing Auth0 SPA SDK's **memory-only** cache. The browser submits it over TLS for each explicit action; the backend does not persist it, issue refresh tokens, or place it in logs/cookies/plugin configuration. There is no owner/internal API token fallback.

## Safe user-initiated E2E path

After website login, workspace selection, and Auth0 linking on `/dsg/autonomous-level`:

- Click **Run user-bound governed read E2E**. The call uses the real Auth0 token and AWS `spacetime_read_public_repo`.
- The fixed read-only AWS route internally creates plan, hashes and binds it, executes with `oauth:<JWT.sub>`, and returns decision, real provider result, evidence receipt and plan hash.
- The frontend separately invokes `spacetime_verify_evidence`, then checks ALLOW, `principal_binding=VERIFIED_OAUTH_SUBJECT`, nonempty plan hash, provider result, evidence receipt and `valid=true` evidence verification.
- This does **not** test approval-required execution: a read-only route intentionally does not need human approval.

## Approval-required E2E (still gated)

`discover → compose → request_approval` may create `WAITING_APPROVAL` only when bound to the verified subject. Do not resolve it automatically.

Existing AWS `spacetime_resolve_approval` currently stamps `customer:<customer-id>` at runtime, not the actual Auth0 user subject. For full user-bound approval, first implement independently reviewed server-side authenticated customer decision validation, exact request and payload hash binding, anti-replay and audit. Then separately request an explicit user decision on the pending approval ID; after it is approved, execute the *same* plan hash/agent/route/payload and verify provider postcondition plus evidence. A general `APPROVE` for this build is not sufficient approval for an unknown future provider action.

## Acceptance criteria

- Identity mapping present and RLS enforced (inspected on Supabase, mapping count=1; no private subject or token exposed).
- CI must pass unit tests for actor-less requests, hostile origin, invalid JWT, conflicting identity, absent identity table, viewer execution denial, forged principal, forbidden self-approval, upstream 401 and evidence-invalid receipt.
- Live read-only E2E requires website login + user Auth0 token from explicit browser action. CI fixtures/mocks **are not** provider execution evidence.
- Full approval-required E2E is **BLOCKED** until exact customer-approval principal gate is implemented and user approves a specific request.
- ChatGPT Android Custom MCP remains host-limited regardless of website bridge success. The website itself can be used from mobile browser, subject to normal authentication.
- Keep Production source/digest unchanged until CI and authorization for deployment; AWS only.

## Non-claims

Neither the database mapping, an Auth0 token exchange, a GitHub CI pass, nor a working `/api/agent/status` proves the new user-bound E2E. Keep `user_oauth_e2e=NOT_VERIFIED` until a witnessed delegated-token AWS read returns actual evidence and passes chain verification.
