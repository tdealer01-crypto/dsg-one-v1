# Codex Parallel Lanes (DSG-5 to DSG-9)

เอกสารนี้สรุป prompt สำหรับรันงาน DSG-5 ถึง DSG-9 แบบแยก lane (หนึ่งงานต่อหนึ่ง branch/PR) เพื่อให้ review, test และ rollback ได้ง่าย

## วิธีใช้งานแบบสั้น

1. เปิด `chatgpt.com/codex`
2. Connect repo: `tdealer01-crypto/dsg-one-v1`
3. สร้าง 5 tasks แยกกัน
4. ใช้ prompt ของแต่ละ lane ด้านล่าง
5. ยืนยันว่าทุก lane เปิด PR แยกกัน (ห้ามรวมงาน)

---

## Lane 1 — DSG-5 GitHub Writer

- Branch: `codex/dsg-5-real-github-writer`
- Scope หลัก:
  - `lib/dsg/app-builder/github-writer.ts`
  - tests for mocked `fetch`
- Acceptance:
  - `npm run dsg:typecheck`
  - `npm run dsg:runtime-check`
  - tests pass

Prompt:

```text
Implement DSG-5: Wire real GitHub Git Trees/Commits writer.

Current scaffold:
- lib/dsg/app-builder/github-writer.ts throws DSG_GITHUB_WRITER_NOT_WIRED_REAL_GITHUB_API_REQUIRED
- lib/dsg/app-builder/file-tree.ts already produces deterministic files/treeHash

Requirements:
1. Replace the fail-closed throw with a real GitHub Git Database API implementation using fetch.
2. Do not add @octokit/rest unless absolutely necessary.
3. Use environment variables:
   - GITHUB_TOKEN
   - DSG_TARGET_REPO or GITHUB_REPOSITORY in owner/repo format
   - DSG_GITHUB_BASE_REF default main
4. Inputs must include branch and FileTree.
5. Validate:
   - branch exists or create it from base ref
   - tree.files is non-empty
   - each file has path/content/fileHash
   - never allow .env except .env.example
   - never allow path traversal
6. Create blobs/trees/commit/ref using GitHub Git Database API:
   - GET ref heads/base
   - GET base commit/tree
   - POST git/blobs
   - POST git/trees with base_tree
   - POST git/commits
   - PATCH or POST refs/heads/branch
7. Return:
   - branch
   - real commitSha from GitHub
   - treeHash
   - baseCommitSha
8. Never return simulated commit SHA.
9. Add tests that mock fetch and verify:
   - missing token blocks
   - empty tree blocks
   - returned commitSha is GitHub response SHA
   - API call order is deterministic enough
```

## Lane 2 — DSG-6 Build Proof Callback

- Branch: `codex/dsg-6-build-proof-callback`
- Scope หลัก:
  - `scripts/dsg-upload-build-proof-evidence.mjs`
  - `app/api/dsg/runtime/build-proof/callback/route.ts`
  - `.github/workflows/dsg-app-builder-build.yml`

Prompt:

```text
Implement DSG-6: Build workflow callback and build proof record.

Current scaffold:
- .github/workflows/dsg-app-builder-build.yml writes .dsg-build-proof/build-proof.json
- app/api/dsg/jobs/[jobId]/build-proof/route.ts currently returns 501
- build proof must not come from client body.ok

Requirements:
1. Add script:
   scripts/dsg-upload-build-proof-evidence.mjs
2. Script reads .dsg-build-proof/build-proof.json.
3. Script signs raw JSON body with HMAC:
   x-dsg-signature: sha256=<hex>
   using DSG_CALLBACK_SECRET.
4. Script posts to:
   DSG_BUILD_PROOF_CALLBACK_URL
5. Add callback route:
   app/api/dsg/runtime/build-proof/callback/route.ts
6. Callback verifies HMAC with timingSafeEqual.
7. Payload must include:
   - jobId
   - branch
   - treeHash
   - githubRunId
   - githubSha
   - status
8. If status is success/pass, record BUILD_VERIFIED.
   If not, record FAILED/BLOCK.
9. Use existing repository/RPC/evidence layer if available.
10. Update workflow to always upload callback after artifact write.

Fail-closed:
- no signature = 401
- missing jobId/treeHash/githubRunId = 400
- failed workflow = record FAILED, not BUILD_VERIFIED
- never use client-supplied body.ok
```

## Lane 3 — DSG-7 Vercel Preview Proof

- Branch: `codex/dsg-7-vercel-preview-proof`
- Scope หลัก:
  - `lib/dsg/app-builder/vercel-preview-proof.ts`
  - `scripts/dsg-vercel-preview-proof.mjs`

Prompt:

```text
Implement DSG-7: Vercel preview deploy proof via real Vercel CLI/API result.

Current scaffold:
- lib/dsg/app-builder/vercel-preview-proof.ts only returns PREVIEW_DEPLOYED from URL presence
- scripts/dsg-vercel-preview-proof.mjs only checks DSG_VERCEL_PREVIEW_URL

Requirements:
1. Replace URL-only proof with real Vercel API/CLI output parsing.
2. Use env:
   - VERCEL_TOKEN
   - VERCEL_ORG_ID or VERCEL_TEAM_ID if needed
   - VERCEL_PROJECT_ID
   - DSG_VERCEL_PREVIEW_URL or deploy output URL
3. Script should:
   - inspect deployment result/status from Vercel API when deployment id/url exists
   - record deployment id/url/status/projectId
   - run basic health fetch against preview URL
   - produce JSON proof artifact with proofHash
4. Library should classify:
   - BLOCK: missing URL/token/project/status
   - PREVIEW_DEPLOYED: deployment exists but health not passed
   - PASS: deployment status ready + health passed
5. Do not claim PRODUCTION from deploy proof.
```

## Lane 4 — DSG-8 Auth/RBAC Proof Probe

- Branch: `codex/dsg-8-auth-rbac-proof-probe`
- Scope หลัก:
  - `app/api/dsg/jobs/[jobId]/auth-rbac-proof/route.ts`
  - `lib/dsg/runtime/auth-rbac-proof.ts`

Prompt:

```text
Implement DSG-8: Auth/RBAC proof via server-side probe or external runner evidence.

Current scaffold:
- app/api/dsg/jobs/[jobId]/auth-rbac-proof/route.ts returns 501
- lib/dsg/runtime/auth-rbac-proof.ts is simple helper

Requirements:
1. Implement a real proof engine that probes preview URL:
   - public routes accessible
   - protected routes reject anonymous access with 401/403/302/307
   - admin routes reject non-admin or anonymous
2. Input must come from server-side job/plan/proof config, not caller booleans.
3. OAuth flows that cannot be automated must return MANUAL_REQUIRED, not PASS.
4. Credentials proof must use real login flow only if test identity is configured.
5. Never use fake cookies.
6. Never accept X-Test-Role or role headers as proof.
```

## Lane 5 — DSG-9 CRUD Generator Contract

- Branch: `codex/dsg-9-crud-generator-contract`
- Scope หลัก:
  - `lib/dsg/app-builder/database-generator.ts`
  - `lib/dsg/app-builder/crud-generator.ts`
  - production flow runner + tests

Prompt:

```text
Implement DSG-9: CRUD generator with route and test data contract.

Current scaffold:
- lib/dsg/app-builder/database-generator.ts creates minimal table
- lib/dsg/app-builder/crud-generator.ts returns simple spec
- production flow runner blocks CRUD proof until route/test contract exists

Requirements:
1. Enhance database generator:
   - deterministic migration for allowlisted table/field names
   - supports string, number, boolean, timestamp, uuid, json
   - includes id uuid primary key
   - includes workspace_id/org_id scope columns
   - no destructive SQL
2. Enhance CRUD generator:
   - generate route template with create/read/update/delete handlers
   - all operations require workspace/org scope
   - generated code must reject missing workspace/org
3. Generate test data contract:
   - create payload
   - expected read assertion
   - update payload
   - delete assertion
```

## Notes

- แนะนำเริ่มตาม dependency: DSG-5 → DSG-6 → DSG-7 และรัน DSG-8, DSG-9 แบบขนาน
- ห้ามรวม 5 งานไว้ PR เดียว
- ถ้า lane ไหนไม่ผ่าน typecheck/tests ให้แก้ใน lane นั้นก่อน merge
