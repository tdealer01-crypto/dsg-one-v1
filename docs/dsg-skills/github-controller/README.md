# DSG GitHub Controller Skill

## Purpose

Govern GitHub repository changes with a truth-first workflow.

Use this skill when an agent needs to inspect, patch, branch, or open PRs in DSG ONE V1.

## Operating rules

1. Inspect real repo files before proposing or changing code.
2. Never create fake evidence, fake deploy URLs, or fake PR links.
3. Prefer branch + draft PR before merge.
4. Keep production deploy separate from code review.
5. State blockers instead of guessing.
6. Keep user benefit visible in every repo action.

## Safe workflow

```txt
inspect repo
lock goal
classify risk
prepare patch
commit to branch
open draft PR
attach evidence
wait for review
```

## Do not do

- Do not merge without explicit instruction.
- Do not run deploy to spend Vercel quota unless proof requires it.
- Do not label mock output as production proof.
- Do not alter backend/runtime when the task is UI-only.

## DSG ONE V1 mapping

This skill maps to the current branch/PR work:

- branch: `customer-workspace-ui`
- PR mode: draft review first
- production deploy: not triggered
- Vercel quota: preserved
