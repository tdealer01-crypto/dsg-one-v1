# DSG Unified Access Hub — governed integration contract (2026-10-10)

## Landing page navigation — 13 October 2026

The single public entry point is **https://dsg.pics/**, served by the existing `dsg-one-v1` website. Repository name **DSG ONE V1** is not a second live website or a different production authority.

The homepage `app/page.tsx` includes a mobile-responsive **DSG ONE — System Access Hub** with these existing routes:

| Surface | Entry | Boundary |
| --- | --- | --- |
| Access Hub | `https://dsg.pics/dsg/access` | DSG website sign-in and workspace membership |
| Workroom / operator hub | `https://dsg.pics/dsg/workroom` | DSG website sign-in and workspace membership |
| DSG Native Desktop | `https://dsg.pics/control/` | Activation/device enrollment/E2E pending; no claim of device access |
| DSG OS | `https://dsg.pics/dsg-os` | Local adapter/evidence tools, never execution authority |
| Cinema Remote Browser controls | `https://dsg.pics/dsg/workroom?tool=browser` | Existing DSG Workroom opens Browser tab; Spacetime Auth0 and signed approval remain mandatory for high-risk Connect/Execute |
| GitBook Docs | `https://dsg-3.gitbook.io/dsg-docs/dsg-docs/dsg-one-canonical-7-docs/` | Canonical Git-synced documents; dated snapshots are not live telemetry |
| Human Approvals | `https://dsg.pics/dsg/approvals` | Linked Auth0 human approver with `dsg.approve`; MFA/production gates apply |
| App Builder | `https://dsg.pics/dsg/app-builder` | DSG authenticated workspace |
| Browser Pilot | `https://dsg.pics/remote-browser-execution` | Public early-access information only |

**20 October 2026 correction:** `https://aws.dsg.pics/app` is the Evidence & Conformance console, NOT the interactive Cinema browser viewer. Do not label it "Cinema" or "Open Shared Browser". The existing Workroom Browser Controls use the governed `node.cinema-remote` route; `?tool=browser` survives site login and opens the advanced Browser tab once a workspace is selected. The evidence console remains available under its accurate label. Cinema status `connected` alone does not prove a signed Navigate/Click/Execute E2E.

**Transport boundary:** `https://aws.dsg.pics/mcp` remains the OAuth-protected production Spacetime execution/governance MCP; `https://aws.dsg.pics/api/v1/mcp` is a separate verification JSON-RPC surface. Do not redirect the browser landing entry or human approvals to either MCP transport.

**Evidence rule:** HTTP 200/307 confirms only surface reachability/login protection, not authorized high-risk execution. Signed read-only provider E2E was verified for its constrained scope; Cinema signed connect/execute, Quest/Unity and whole-system E2E are still NOT VERIFIED. This documentation describes the proposed homepage change until code merges, deploys, and independent public readback passes.


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
- `user_oauth_e2e` and `provider_execution_e2e`: report **this specific website session** as `NOT_VERIFIED` until it executes and verifies a delegated Auth0 provider action; reachability never upgrades these.
- `historical_readonly_e2e`: `state=REVIEW` for **current readiness**, `historical_result=PASS` for the independently verified 11 October 2026 real-user governed GitHub metadata read-only route and signed Provider v2 Ed25519 evidence. The signed execution checkpoint was chain 139, with subsequent valid 140-record authenticated readback; this endpoint reports `evidence_chain_observed_20261011=140`. [Public AWS Control Plane acceptance](https://dsg-3.gitbook.io/dsg-docs/control-plane/). No fresh site-session OAuth or Cinema/Quest/whole-system claim.
- The Access Console displays both fields side-by-side to prevent false negative retesting of completed low-risk acceptance and false positive promotion of unrelated high-risk actions.
- ChatGPT Android Custom MCP unavailable per current support guidance; compatibility of a **different** app mechanism must be proven rather than assumed.

**Deployment policy:** AWS-only, no Azure. CI and security review before merge; no automated production promotion from this documentation.


## 31 October 2026 — Agent v0 / Safe Autonomy production checkpoint

A fresh authenticated AWS Spacetime verification on the current production deployment proved the canonical `route.agent.dsg-v0.plan` route for its exact proposal-only scope:

- decision: `ALLOW`
- provider: `nvidia`
- model: `nvidia/nemotron-3.5-lightning-30b-a3b`
- brain mode: `nvidia_nemotron_planner`
- authority: `proposal-only`
- execution authority: `NONE`
- Action Kernel: `Z3_QUBO_TOP_K`, solver pipeline `z3 → ising-qubo → z3`
- evidence chain: valid at 553 records before the call; new evidence index 553; valid at 554 records after the append

The DSG ONE autonomous-level readback remains `DSG_AUTONOMOUS_LEVEL_PARTIAL` at 1/9 required capabilities. Therefore the website may describe **Safe Autonomy**, not Full Autonomy: plan-authorized low-risk/read-only actions may continue automatically, while Approval, MFA, signed permits, paid resources, destructive mutations and scope changes remain fail-closed gates.

This checkpoint supersedes stale homepage wording that implied the canonical planner depended on an unavailable Kaggle Worker. The existing Kaggle free-GPU path remains a bounded legacy fallback in source; it is not the current verified production planner identity and must not be presented as required for the successful NVIDIA route.
