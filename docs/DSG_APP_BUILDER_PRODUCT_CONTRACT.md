# DSG App Builder Product Contract

## Purpose

DSG App Builder converts a locked user goal into a governed app-building plan.

Step 15 is a planning layer only. It creates contracts, PRD, proposed plan, gate result, approval hashes, and runtime handoff data.

## Canonical Flow

```txt
User Goal
↓
Goal Lock
↓
PRD
↓
Proposed Plan
↓
Plan Gate
↓
Approval
↓
planHash + approvalHash
↓
Runtime Handoff
↓
Step 16 Runtime
```

## Rules

- No locked goal means no PRD.
- No PRD means no plan.
- Gate BLOCK cannot be approved.
- No planHash means no runtime handoff.
- No approved plan means no runtime handoff.
- Runtime handoff uses planHash as the stable authorization hash.
- approvalHash is for approval audit tracking.
- Step 15 does not execute commands.
- Step 15 does not deploy previews.
- Step 15 does not claim production readiness.

## Allowed Step 15 Claims

```txt
APP_BUILDER_PRODUCT_CONTRACT_READY
APP_BUILDER_PLANNING_LAYER_READY
READY_FOR_STEP_16_RUNTIME_FOUNDATION
```

## Blocked Claims

```txt
RUNTIME_READY
DEPLOY_READY
PRODUCTION_READY
MANUS_CLONE_COMPLETE
```
