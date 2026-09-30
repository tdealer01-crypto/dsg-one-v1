# DSG ONE AWS function cutover — 2026-09-30

Status: **PARTIAL / SOURCE_AND_ROUTE_VERIFIED**, not whole-system production E2E. This ledger separates live HTTP reachability from real authorized execution and should not be used to claim all functions migrated or autonomous 9/9 verified.

## Observed production routing

- DNS: `dsg.pics` and `www.dsg.pics` resolve to existing AWS EC2 Elastic IP `3.212.14.49`; TLS covers both hostnames. `www` redirects to the apex.
- Existing AWS EC2 serves `aws-dsg-one-v1-1`, `aws-spacetime-1`, and `aws-cinema-1` as healthy containers. Public `https://dsg.pics/` responds 200.
- Live DSG ONE `/api/agent/status` reports source `00f97e4ed88c8a0cf8387542191f8734b4246b4a` / production. **A passing PR does not change this serving SHA.**
- `https://dsg.pics/access` redirects 302 to `/dsg/access`; unauthenticated `/dsg/access` redirects 307 to `/login`; `/login` responds 200. The user session endpoint `/api/dsg/access/session` responds 401 without a session.
- Public Spacetime MCP remains `https://aws.dsg.pics/mcp`, unauthenticated 401; protected-resource OAuth metadata 200. It must not be proxied through an unrestricted website API.
- AWS Spacetime's explicit internal provider URLs are `http://dsg-one-v1:8080/api/mcp-server` and `http://cinema:8000` with co-located internal transport; the Cinema credential key is configured (value was **not** read). RCA/BrowserOS connection must remain approval-bound.
- Verified Nginx/Certbot certificates and automatic renewal are a web-edge proof only, not executor proof.

## Source inventory versus execution

Default `main` tree contains **37 page routes and 118 API route files**. Source route registration is not equal to 155 tested E2E operations. The public HTTP sample covers 32 paths (non-mutating requests only):

| Category | Evidence | Boundary |
| --- | --- | --- |
| Home, Login, Skill catalog, AGI, product-ready | HTTP 200 without login | Presentation/API availability only |
| App Builder, Flow Studio, Governance, Autonomous Level, Templates, History, Analytics and other `/dsg/*` pages | Redirect 307 to protected Login | Authentication enforced; owner login/authorization NOT_VERIFIED |
| Enterprise protected pages | Redirect 307 to Login | No RBAC/entitlement assertion from redirect alone |
| `/api/agent/status`, autonomous-status, marketplace readiness, services, browser provider registry, public app MCP | HTTP 200 | Inspect returned readiness fields; 200 is not automatic execution PASS |
| `/api/dsg/access/session` | HTTP 401 without session | Negative authentication proof only |
| `https://aws.dsg.pics/mcp` | HTTP 401 without token | Negative OAuth gate proof only; live authenticated connector not proven by this audit |

## Unverified or incomplete integrations

1. **Access Hub navigation:** release branch PR #160 replaces retired Azure UI hrefs with inspected AWS App Builder/Governance/health paths, disables UI links that have no verified AWS destination, and updates the default OpenRouter referer and CI/ship prod host. **Draft and not deployed.**
2. **Website auth versus MCP auth:** DSG ONE web login uses Supabase-backed session cookies. The MCP resource is protected via Auth0. A web session is not an MCP service credential; no automatic token sharing.
3. **Cinema versus DSG ONE Browser registry:** Cinema is running behind Spacetime on AWS, but the DSG ONE local `remote.browser.session` registry still reports `connector_required`/`not_implemented_in_repo`. Do not advertise autonomous remote control from the DSG ONE registry yet.
4. **Owner Android/RDC:** `DSG_RDC_MCP_URL`, `DSG_RDC_ACCESS_TOKEN`, `DSG_RDC_DEVICE_ID` were not bound in the production Spacetime container when checked. Device-local ChatGPT RDC read-only proof is not AWS provider E2E.
5. **Autonomous Level 9/9:** the API publishes `DSG_AUTONOMOUS_LEVEL_COMPLETE` from `lib/dsg/autonomous-level/provider-proof-summary.ts`, which contains a static summary and manual browser evidence. It is **not** an independently reproduced live all-capability E2E result; preserve the distinction.
6. **Workroom:** `/api/ui/live` and `/api/ui/goal-proposal` are not implemented on the served DSG ONE V1 Next.js app. Do not route these to placeholder endpoints or grant browser execution outside Spacetime.
7. **Historic Azure workflows:** manual Azure rollback/Key Vault/training artifacts are not AWS production paths. Do not aim unsafe synthetic-approval runtime-proof steps at `dsg.pics`. They require a separate authenticated/approved AWS test contract or explicit deprecation.
8. **Release parity:** only merge after exact-head CI, then separately check exact-main, immutable ECR digest, EC2 serving image, public route headers, OAuth negatives, and actual owner-authorized provider/evidence receipts. ECR build/deploy and unused Azure shutdown have separate monetary/production-impact authorization gates.

## Narrow actionable gate sequence

1. Keep all current public DNS and TLS records; do not open another EC2 or CDP port.
2. Review PR #160 and private runtime PR #514 for static AWS references, explicit Cinema provider binding and non-regression test results.
3. Do not ship either PR until exact-head required CI is green and owner-approved cost/change-control conditions are satisfied. No active Azure fallback may be added.
4. Separately provision server-side RDC provider credentials through a supported secure secret-reference path. Never reuse ChatGPT-held OAuth tokens.
5. Run and preserve an owner-authorized browser negative BLOCK + exact approval + ALLOW + provider readback + `spacetime_verify_evidence.valid` proof. Only then assert the specific governed browser E2E.

Source audit basis: `tdealer01-crypto/dsg-one-v1` main `00f97e4ed88c8a0cf8387542191f8734b4246b4a`, AWS EC2/Nginx readback on 2026-09-30, and private Spacetime production env-name-only inspection. Avoid copying raw secrets into this document.
