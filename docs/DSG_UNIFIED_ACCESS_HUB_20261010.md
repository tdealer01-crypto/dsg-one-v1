# DSG Unified Access Hub — governed integration contract (2026-10-10)

## Existing components (no replacement)

- **DSG ONE** (`https://dsg.pics`): authenticated Workroom and workspace membership using its own Supabase-backed website session.
- **DSG Spacetime** (`https://aws.dsg.pics/mcp`): canonical AWS authorization, plan/policy/approval, provider execution, evidence verification. The protected resource and Auth0 issuer are separate from the website session.
- **Goal-first Lab**: separate ChatGPT app-local proposal/skill entry. Success of `dsg_agent_skills` does not verify AWS provider execution.
- **Execution Evidence**: separate ChatGPT evidence/status app. Anonymous `/api/agent/status` success cannot prove user's connector OAuth session. The Site-owned service credential is not the user's principal.
- **DSG Spacetime live**: existing ChatGPT custom MCP OAuth connector. ChatGPT mobile host support for this custom connector is not a website feature and cannot be fixed by routing through the website.
- **Cinema / RDC / XR / Agent v0**: existing provider or proposal surfaces; not alternate authorization authorities.

## This PR — implemented

`GET /api/dsg/integrations/status` is a **read-only integration coordination check**:

1. Authenticate with the existing DSG website session and re-verify workspace membership server-side. Fail closed without actor/workspace.
2. Check the canonical AWS MCP protected-resource metadata and **exact** expected resource/issuer. This is metadata reachability, **not OAuth access**.
3. Check the deployed DSG ONE `/api/agent/status` health and exact image/source binding. This is application readiness, **not execution**.
4. Report the Workroom authenticated website session, companion app identity boundaries, and explicit `NOT_VERIFIED` for delegated Auth0, provider execution, and ChatGPT mobile support.
5. Surface all readouts on existing `/dsg/access`, only after verified workspace selection. Do not expose tokens, service keys, caller IPs or provider credentials.

All calls are GET, fixed-origin, 5-second-bounded, no redirects and `no-store`. This PR adds **no deploy**, no new MCP authority, no new Auth0 client, and no secret-binding change.

## Next acceptance — not implemented by this PR

To genuinely issue actions across these surfaces under one verified user:

1. Establish **explicit user-delegated Auth0** for the website channel. Map Supabase website actor/workspace to a verified Auth0 subject without impersonation; reject identity mismatches.
2. Implement a server-side per-user OAuth credential/session binding with PKCE, CSRF/state, secure storage, refresh/revocation, and least-privilege scope. Never place access/refresh tokens in a ChatGPT message or browser local storage.
3. Use a single canonical `spacetime_discover → spacetime_compose → approval when required → spacetime_execute → spacetime_verify_evidence → provider postcondition` chain. Preserve exact agent principal, plan hash, route and payload hashes; fail closed if any are unbound.
4. Consume Goal-first Lab's proposal as **data**, not as authority. Attach Execution Evidence references for readback, never infer chain validity from an anonymous Site response.
5. Verify each user channel independently (ChatGPT Web custom MCP, mobile-supported companion Site app, and authenticated Workroom). No host-mobile support assertion without a witnessed mobile user session.
6. Run end-to-end test with authenticated user principal, approval-required BLOCK, approved ALLOW, provider receipt, evidence hash and independently verified postcondition. Only then mark `VERIFIED_COMPLETED`.

## Status gates

- `APP_HEALTH_AND_IMAGE_BOUND`: verified app deployment identity only.
- `METADATA_MATCH`: verified OAuth metadata only.
- `VERIFIED_SITE_SESSION`: authenticated website/workspace only.
- `user_oauth_e2e` and `provider_execution_e2e`: fixed `NOT_VERIFIED` until an authenticated governed execution supplies proof.
- ChatGPT Android Custom MCP unavailable per current support guidance; compatibility of a **different** app mechanism must be proven rather than assumed.

**Deployment policy:** AWS-only, no Azure. CI and security review before merge; no automated production promotion from this documentation.
