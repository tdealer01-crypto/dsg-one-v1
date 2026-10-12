# DSG Human Approver — Real MFA Read-only Probe (2026-10-12)

## State and scope

The user approved production AWS Human Approval Gate enablement for joint MFA acceptance testing. The current AWS Spacetime is still healthy on previous image `sha256:fd718ca2ed2ab3de5da40fe987d83f45788636eb0d0edc0251f27b53e8e4f701` and **no Human Approval runtime flags have been activated**. Exact protected-main build #38268585194 was launched at `9190705d8980b371037976897dcdd4c611407cdd` and remains independently gated by ECR scan/release manifest/owner workflow. Do not mislabel an image build as AWS Activation.

## Real Auth0 tenant evidence

- Dedicated SPA `DSG ONE Human Approver`, `jI1uiKcQu7mqORsaCrogKTQVsAcZuQSt`, approved redirect `https://dsg.pics/dsg/approvals`, API `https://aws.dsg.pics` scopes `dsg.use` and `dsg.approve`.
- Auth0 Post-Login v3 Actions created, deployed and their **exact binding order independently read back** from Auth0 Management API: `dsg-approver-otp-challenge` id `fc698da7-2448-4376-84e6-1e624a32e663` (version 1), followed by `dsg-approver-signed-mfa-claims` id `943c9ece-450c-47a7-9f61-eb394abd9e58` (version 1). Both are scoped internally to the dedicated SPA and exact API audience; all other clients do not trigger OTP.
- OTP factor enabled, global Guardian policy `[]`. Real owner OTP enrollment and actual MFA JWT signature-based proof **not verified yet**.

## User-operated proof, independent from pending AWS approval

- User signs into `https://dsg.pics/dsg/approvals` in a browser as the previously linked DSG account.
- Button **ทดสอบ MFA (ไม่อนุมัติ)** opens a fresh interactive Auth0 authorization with `prompt=login`, `max_age=0`, `ext_dsg_stepup=1` for dedicated SPA. Real owner enters their OTP in Auth0; no codes, secrets or bearer tokens in ChatGPT.
- Read-only endpoint `POST /api/dsg/approvals/mfa-check` checks signed Auth0 JWT issuer, audience, allowed `azp`, `dsg.approve`, expiry and `sub` binding to existing DSG website principal via server-only Supabase. Requires namespaced signed `reauth_method=mfa` and integer `reauth_at` within 120 seconds of both current time and token issuance. Returns only `mfaVerified` boolean. No permit, approval, AWS calls, provider execution or new stored credentials. Absent/wrong/stale credentials deny.
- This probe is a **necessary preliminary MFA check but not a sufficient production approval E2E**. Signed high-risk Cinema Connect/Execute, ledger and permit/replay evidence remain blocked until independent AWS owner-gated Activation and E2E.

## Preconditions after website merge

- CI and review must pass exact-head, then protected merge and independent post-merge ship/readback; before that the button is only source code.
- Auth0 tenant must actually issue `dsg.approve` in a scoped token, and user must have OTP enrolled. If popup blocked on Android, re-open the site in a full Chrome browser.
- Separately preserve previous delegated agent `dsg.use` issuer and identity links; never grant human authority to ChatGPT/DCR or to `DSG Scientific Discovery v3` client.
- Do not turn on AWS flags before exact running Spacetime image implements fail-closed `authorized_high_risk_approver` and passes ECR/manifest/review gates.
