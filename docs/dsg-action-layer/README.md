# DSG Action Layer GED

Customer-facing studio orchestration layer for DSG ONE V1.

## Purpose

This layer turns a user goal into:

1. a stable visible plan,
2. explicit permission checkpoints,
3. approved execution stages,
4. visible evidence collection,
5. a final review boundary.

It is a **contract and UX control layer**, not a remote-browser executor by itself.

## Use in DSG ONE V1

- Plan Pane: render the goal, architecture, stages, risks, permissions, and definition of success before execution.
- Execution Pane: render running state, current stage, evidence, checkpoints, and next action after approval.
- Browser Operator: define browser-first behavior, visible evidence discipline, and login/takeover pauses.
- Local Ops Controller: define what the studio may do automatically after approval.

## Truth boundary

Remote browser automation remains `connector_required` until a real executor is wired, such as Playwright, Puppeteer, Browserbase, Steel, or another browser session service.

## Imported source files

These docs are based on the uploaded action-layer references:

- `SKILL.md`
- `openai.yaml`
- `browser-operator.md`
- `deterministic-studio-rules.md`
- `execution-pane-json-contract.md`
- `execution-pane-schema.md`
- `local-ops-controller.md`
- `plan-pane-json-contract.md`
- `plan-panel.md`
- `plan-pane-schema.md`

## Production rule

Do not trigger Vercel deployment from these docs. They define behavior and UI contracts only.
