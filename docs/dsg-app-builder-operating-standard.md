# DSG App Builder Operating Standard

## Goal

Build real user-requested applications with evidence, not fake success.

DSG App Builder is a governed AI app-building workflow. It must behave like a production-grade product workflow, not a blind code generator.

## Core rules

- No verified understanding, no plan.
- No evidence when evidence is required, no plan.
- No plan/build convergence, no approval.
- No approval, no runtime.
- No runtime, no pull request.
- No smoke test, no production claim.
- Generic fallback is blocked.

## Market patterns adapted for DSG

DSG may reuse market-proven product patterns, but must not copy proprietary code, private prompts, brand assets, or unique product text from other vendors.

| Market pattern | DSG adaptation |
| --- | --- |
| Plan mode before coding | Design Draft and Plan Candidate must exist before runtime. |
| Ask/read-only mode | Design Mode can analyze and explain but cannot write files. |
| Agent/build mode | Runtime can write files only after approval and gate checks. |
| Pull request evidence | PR is implementation evidence only, not production proof. |
| Preview deployment | Preview must be built and smoke-tested before claims improve. |
| Human review | Manual approval remains required for production claims. |
| Browser full-stack experience | DSG must show UI, API, preview, and evidence in one workspace. |
| Lifecycle product | DSG covers design, evidence, plan, build, PR, preview, smoke test, and production gate. |

## Flow

### 1. Design Mode

The AI talks with the user and extracts:

- user goal
- target user
- screens
- user actions
- API requirements
- data requirements
- evidence requirements
- truth boundary

The AI must create a Design Draft. If the Design Draft is empty, Build Now is disabled.

### 2. Unknown / Evidence Gate

If a requirement contains unknown terms, current facts, external APIs, URLs, laws, pricing, latest data, or provider docs, source evidence is required.

Allowed evidence sources include:

- search engine results
- repository inspection
- API docs
- user-provided files
- verified endpoint responses

If search/evidence fails:

- status = `BLOCKED_EXTERNAL_EVIDENCE_REQUIRED`
- no plan
- no approval
- no runtime
- no PR

If the requirement is fully user-defined, the planner may proceed from user-provided requirements only. It must not claim external/provider proof without evidence.

### 3. Plan Mode

Generate a Plan Candidate.

The plan must include:

- screens
- API routes
- database/migration
- audit/evidence
- success criteria
- blocked claims

AI reviews plan vs expected app. If there is a mismatch, revise the plan and do not approve.

### 4. Build Candidate Mode

Generate candidate files in memory first.

Do not write a GitHub branch yet. Do not open a PR yet.

### 5. Plan and Build Convergence Loop

Review:

- Build Candidate vs Plan
- Plan vs Expected App
- deterministic file paths and blocked patterns

If there is a mismatch, revise build or plan and loop again.

If the loop exceeds the configured maximum attempts:

- status = `CONVERGENCE_FAILED`
- no PR

### 6. Generic Fallback Block

Block immediately if generated files include:

- `items/route.ts`
- `create_generated_app_items`
- todo/list/add-item template
- generic CRUD that does not match the user requirement

### 7. Final AI Review Before PR

Send the AI reviewer:

- user goal
- design draft
- plan
- file paths
- file samples
- expected evidence

The AI reviewer returns `PASS` or `BLOCK` only.

If `BLOCK`, do not create a GitHub branch and do not open a PR.

If AI review is unavailable, block and do not open a PR.

### 8. PR Mode

Only after PASS:

- create branch
- write generated files
- open GitHub PR

The PR body must include:

- plan hash
- approval hash
- generator mode
- claim boundary
- file list
- evidence checklist

### 9. Preview Mode

Wait for Vercel preview.

If build fails:

- status = `IMPLEMENTED_UNVERIFIED_FAILED`
- do not merge

If preview is ready, run smoke tests.

### 10. Smoke Test Mode

Smoke tests must verify:

- page opens
- primary UI action works
- backend API responds
- evidence is visible
- requestHash/auditHash exists when required

### 11. Production Claim Gate

Production claim is allowed only if:

- CI green
- typecheck green
- preview ready
- API smoke test passed
- migration proof passed
- manual approval passed
- no fake/mock/test data in production

Otherwise:

- claimStatus = `IMPLEMENTED_UNVERIFIED`

## UI/UX standard

DSG App Builder UI must show status explicitly. It must not hide blocked states behind generic success.

### Required lanes

- Design Draft
- Evidence
- Plan
- Build Candidate
- Convergence
- Approval
- Runtime
- PR
- Preview
- Smoke Test
- Production Claim

### Status colors

- Gold = ready to continue
- Red = blocked or failed
- Silver = inspect details
- Green = verified pass

### Required user affordances

Every important panel must have at least one real action:

- create draft
- inspect evidence
- copy proof
- download report
- open PR
- open preview
- run smoke test

No button may be displayed if it has no implemented action.

## Virtual PC required output contract

When the user requests a Virtual PC / Windows / remote mouse / monitor app, the generated output must include:

### Expected files

- `app/generated-apps/<id>/page.tsx`
- `app/api/generated-apps/<id>/remote-mouse/route.ts`
- `supabase/migrations/*virtual_pc_mouse_events*.sql`
- `docs/dsg-generated-apps/<id>.md`

### Required UI

- virtual monitor
- cursor position
- click/move controls
- governance evidence panel
- requestHash
- auditHash
- truth boundary

### Required API

`POST /api/generated-apps/<id>/remote-mouse`

### Required API response

- decision
- status
- cursor
- invariantResults
- requestHash
- auditHash
- truthBoundary

### Blocked outputs

- `items/route.ts`
- `create_generated_app_items`
- todo app
- generic CRUD
- claim of real Windows VM without provider proof

## Acceptance criteria for this standard

A generated app may proceed to PR only when:

- Design Draft exists.
- Evidence gate is PASS or not required.
- Plan Candidate exists.
- Build Candidate exists.
- Plan/build convergence is PASS.
- Deterministic blocked-file gate is PASS.
- Final AI review is PASS.
- Generic fallback is not used.

A generated app may claim production only when:

- CI/typecheck/build pass.
- Preview is ready.
- Smoke tests pass.
- Migration proof exists where applicable.
- Manual approval exists.
- No fake/mock/test data is present in production.
