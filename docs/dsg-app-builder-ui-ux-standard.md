# DSG App Builder UI/UX Standard

This document defines the baseline user experience for DSG App Builder. It adapts proven market patterns into DSG-specific governed workflows.

## Product positioning

DSG App Builder is a governed AI application builder. It must help users move from idea to evidence-backed implementation without pretending incomplete work is production-ready.

## Market-inspired patterns, rewritten for DSG

### 1. Plan-first experience

Users should see a clear plan before files are written. Plan-first means:

- the AI summarizes the desired app
- the user sees screens, API routes, data model, and evidence needs
- the system reviews the plan against the expected app
- no runtime starts until the plan is accepted

### 2. Mode separation

The interface must separate modes:

- Ask / Design: AI can analyze and draft, no file writes
- Plan: AI proposes implementation path, no runtime
- Build Candidate: generated files are held for review, no PR
- Runtime: writes files only after gates pass
- Verify: preview and smoke tests
- Production Gate: manual approval and proof-based claim upgrade

### 3. Evidence-first progress

Every status must show evidence, not only labels.

Examples:

- Plan hash
- Approval hash
- PR URL
- Preview URL
- Smoke test result
- API response proof
- requestHash/auditHash where applicable

### 4. No fake readiness

The UI must not show production-ready, deployable, verified, or complete unless the corresponding proof exists.

Allowed claim language:

- Planned only
- Implemented unverified
- Preview ready
- Smoke tested
- Production verified

Blocked claim language without proof:

- Production ready
- Fully verified
- Working Windows VM
- Live provider connected
- Real data verified

## Required layout

The App Builder workspace should use a three-column or stacked mobile-first layout.

### Column / Section 1: Conversation and Design Draft

Required components:

- AI chat
- Design Draft card
- Extracted requirements
- Missing information list
- Build Now disabled state when draft is missing

### Column / Section 2: Governed Build Pipeline

Required cards:

1. Evidence Gate
2. Plan Candidate
3. Build Candidate
4. Convergence Review
5. Approval
6. Runtime Handoff
7. PR Evidence
8. Preview
9. Smoke Test
10. Production Claim Gate

### Column / Section 3: Proof and Preview

Required components:

- PR panel
- Preview panel
- Endpoint proof panel
- Audit/proof download or copy actions
- Claim boundary panel

## Button rules

Every visible button must do a real action.

Allowed examples:

- Create Design Draft
- Inspect Evidence
- Generate Plan
- Review Plan
- Generate Build Candidate
- Run Convergence Review
- Approve Plan
- Launch Runtime
- Open PR
- Open Preview
- Run Smoke Test
- Copy Proof
- Download Report

Blocked examples:

- buttons that do nothing
- fake preview buttons
- generic “Complete” buttons without proof
- hidden errors after click

## State model

```txt
DESIGN_DRAFT_REQUIRED
DESIGN_DRAFT_READY
EVIDENCE_REVIEWING
BLOCKED_EXTERNAL_EVIDENCE_REQUIRED
PLAN_CANDIDATE_CREATED
PLAN_REVISE_REQUIRED
BUILD_CANDIDATE_CREATED
BUILD_REVISE_REQUIRED
CONVERGENCE_REVIEWING
CONVERGED_PASS
CONVERGENCE_FAILED
WAITING_APPROVAL
READY_FOR_RUNTIME
RUNTIME_EXECUTING
PR_CREATED
PREVIEW_BUILDING
PREVIEW_READY
PREVIEW_FAILED
SMOKE_TESTING
SMOKE_TEST_PASSED
SMOKE_TEST_FAILED
IMPLEMENTED_UNVERIFIED
PRODUCTION_VERIFIED
```

## Color semantics

- Gold: next action is available
- Red: blocked, failed, or requires correction
- Silver: details available for inspection
- Green: verified pass with evidence

## Mobile-first requirements

- Cards must be readable on mobile.
- Primary action must stay visible near the current state.
- Long hashes must wrap or be copyable.
- Error states must show required fixes.
- Preview must not hide evidence panels.

## Virtual PC UX standard

When building Virtual PC apps, UI must include:

- virtual monitor surface
- cursor marker
- click / move / double-click actions
- remote mouse API contract
- invariant decision panel
- requestHash and auditHash display
- truth boundary that real Windows VM/provider is not proven until provider proof exists

The UI must block or warn if it cannot prove provider/runtime state.

## Evidence panel copy standard

Use clear claim boundaries:

- “This proves generated implementation files only.”
- “This does not prove production deployment.”
- “This does not prove a real Windows VM provider is attached.”
- “This endpoint records governed mouse intent only.”

## Acceptance criteria

The UI/UX standard is met when:

- Build Now is disabled without Design Draft.
- Pipeline cards show current state and next action.
- Blocked states show required fixes.
- PR evidence appears only after runtime passes.
- Preview evidence appears only after Vercel preview is ready.
- Smoke test evidence appears only after actual test execution.
- Production claim remains blocked until proof is complete.
