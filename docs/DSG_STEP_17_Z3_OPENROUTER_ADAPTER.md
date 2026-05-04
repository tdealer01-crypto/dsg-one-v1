# DSG Step 17: Z3 Plan Observer + OpenRouter Adapter

## Purpose

This step adds two bounded components for the DSG App Builder.

## Z3 Plan Observer

`Z3_PLAN_FEASIBILITY_OBSERVER` observes proposed plans only.

It does not execute actions, approve actions, replace RBAC, replace Risk Control, write files, deploy, or claim production.

## OpenRouter Adapter

The adapter calls OpenRouter for model-assisted planning or code suggestions.

Default model:

```text
openrouter/free
```

It supports fallback models through a comma-separated environment variable and fails closed when the API key is missing.

Do not paste API keys into chat.

## Smoke

Run directly:

```bash
OPENROUTER_MODEL="openrouter/free" node scripts/dsg-openrouter-smoke.mjs
```

Expected pass line:

```text
PASS: DSG OpenRouter adapter smoke completed
```

## Correct boundary

Allowed claim after smoke passes:

```text
OPENROUTER_ADAPTER_SMOKE_PASS
Z3_PLAN_OBSERVER_ADDED
```

Blocked claims:

```text
KIMI_RUNTIME_READY
MANUS_LEVEL_BUILDER
PRODUCTION_READY
```
