# DSG ONE — Supervised Pilot: Public Verification Note

**Evidence checkpoint:** 24 October 2026 (Asia/Bangkok)

This is a static, public-facing summary for external reviewers and AI tools that cannot crawl the AppDeploy-hosted application. It is NOT a live monitoring endpoint, and it does not contain private credentials.

## Links

- Public product introduction: https://dsg.pics/
- Human pilot login: https://dsg-one-cloud-computer-dmsmbp.v2.appdeploy.ai/
- Fixed public repository read-only target: https://github.com/tdealer01-crypto/DSG-Spacetime-Source
- Public existing GitBook guide (dated earlier): https://dsg-3.gitbook.io/dsg-docs/dsg-one-or-start-here.md

## Verified or source-inspected as of the checkpoint

1. AppDeploy reported `READY`, validation passed and no frontend/backend QA errors for the Cloud Computer app at snapshot `1792856265693`. This does **not** prove an external tester successfully completed a login or job.
2. The deployed app's `public/robots.txt` contains:

   ```text
   User-agent: *
   Allow: /
   Disallow: /api/
   ```

   An independent external fetcher successfully retrieved the new robots file and anonymous sign-in page. A separate AI web browsing tool still could not fetch the AppDeploy hostname. Crawler compatibility is tool-specific.
3. Through the authenticated DSG owner-service bridge, a fixed private-production-repository metadata read went through discover, compose, execute and evidence verification with status `SITE_EXECUTION_VERIFIED` (evidence index 358, chain valid at 359 records at that moment). This is **not** a member-session test.
4. Through an OAuth-bound DSG Native plugin, fixed public GitHub metadata route `route.github-public.repo-metadata-read` returned `ALLOW`, a live result and recorded evidence (index 359). A later `route.identity-access.scope-read` returned `ALLOW` and appended evidence index 360; the evidence chain then reported `valid=true`, 361 records.
5. A read-only security negative test attempted the high-risk Native Shell route without an approval permit. The Runtime returned `BLOCK / APPROVAL_REQUIRED`, with `result=null` and `evidence=null`. This confirms denial of that exact attempt, **not** a completed approval flow or an auditable denial receipt.
6. Source inspection of the AppDeploy member pilot shows per-account history tables using authenticated AppDeploy user IDs, a fixed public GitHub read-only demo, and a three-jobs-per-UTC-day limit. The login is Google + separate DSG OAuth. Native/Cinema and Owner Workspace remain protected from members.

## Still NOT VERIFIED

- End-to-end pilot execution with a distinct real external member Google/DSG OAuth account.
- Two-account data isolation or successful cross-account denial tests.
- Durable job history after reload with a real external member.
- Member private compute provisioning or Native/Cinema/browser execution.
- Owner MFA → signed approval permit → high-risk execution → evidence E2E.

## How a human external tester can evaluate

1. Open the pilot link in a normal browser; sign in with their own Google account.
2. Connect the matching DSG OAuth identity, submit the Pilot request, then run the limited Public Read Demo (if enabled).
3. Record the resulting status, plan ID, evidence index/hash, and chain status. Reload and confirm the same job persists.
4. In a separately authorized second test account, verify that the first account's history and all Owner APIs are inaccessible.
5. If any phase is blocked, record the exact code; never label it PASS without evidence.

## Summary / ภาษาไทย

**Partial Pass only.** Production has real scoped read-only execution/evidence proof and a real approval-denial test. The Cloud Computer member pilot has deployed code, but the external-member and two-account tests remain unverified. บอทบางเครื่องมือยังอ่านโดเมน AppDeploy ไม่ได้ แม้ robots.txt อนุญาตแล้ว จึงควรใช้ไฟล์นี้ประกอบการประเมินและไม่อ้างว่า Member Pilot ผ่าน E2E ทั้งระบบ.
