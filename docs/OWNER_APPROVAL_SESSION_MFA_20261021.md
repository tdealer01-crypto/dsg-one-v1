# Owner approval: login + MFA once, per-command confirmation (2026-10-21)

## Problem and observed evidence
- Android screenshot showed `AUTH0_CALLBACK_TRANSACTION_LOST` on `https://dsg.pics/dsg/approvals` and repeated login redirects.
- Existing SPA persisted OAuth PKCE transactions in sessionStorage; cross-tab callbacks can lose the transaction.
- Source had a 120-second signed MFA age gate in both website and AWS, and automatically launched another Auth0 step-up from each high-risk approval.

## Authorized UX
1. Owner opens exact request or pending list and explicitly taps **เข้าสู่ระบบและยืนยัน MFA ครั้งเดียว** (the dedicated approver Auth0 SPA).
2. Authentication triggers actual OTP challenge only if Auth0 does not already have a signed and current MFA method from the same session.
3. Owner inspects the exact request, then taps **ตกลง · อนุมัติคำสั่งนี้** or rejects it; no additional redirect for each action.
4. AWS independently verifies signed JWT (issuer/audience/`sub`/`azp`/`dsg.approve`/`exp`), real MFA timestamp and method within 8-hour maximum, exact viewed request/subject hash, signed approval and single-use permit. The requester separately claims and executes; UI does not execute tasks directly.
5. If the MFA session or access token is invalid, do not approve. Show a single explicit re-login action. No automated MFA redirect loop.

## Source changes (pending CI, no production claim)
- `useCookiesForTransactions: true` for dedicated approver only (OAuth transaction cookie), `cacheLocation: 'memory'` preserved for access tokens.
- Remove implicit login from exact-request link; preserve request ID through callback.
- Set `ext_dsg_stepup=1` at explicit initial login, not during each decision.
- Website signed MFA window 8 hours, still bound to JWT signature and expiration; no new Client ID.
- High-risk approval checks signed session MFA without launching Auth0 again. Exact-request click remains mandatory.

## Separate release dependencies
- AWS runtime PR must be merged and promoted before browser UX change is rolled out. Its server gate currently accepts only 120-second MFA by default.
- Real Auth0 tenant **must** deploy/rebind existing scoped challenge+signed-claim Actions from the corresponding AWS runtime PR, preserving app client/audience, OTP factor, and grant boundaries. Source file changes alone do not modify tenant Actions.
- Verify actual JWT/claim lifetime and browser token expiry in production. User experience is bounded by the earlier of token expiration and 8 hours; silent renewals must still carry real Auth0 MFA event, not a fresh `iat` substitute.
- Run exact-source tests, build, security negatives, deploy readback, real owner browser callback and authenticated request approval, requester claim/execute, and evidence verification.

Until all checks pass: `PRODUCTION_OWNER_APPROVAL_E2E=NOT_VERIFIED`. Do not disable MFA, auto-approve, forge claims, or bypass route authorization.
