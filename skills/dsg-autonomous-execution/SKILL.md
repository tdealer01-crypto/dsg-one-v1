# DSG Autonomous Execution Skill

## Purpose

Use this skill for DSG autonomous work where speed is useful but correctness is mandatory. The skill turns user goals into deterministic, evidence-backed execution while keeping incomplete runtime claims fail-closed.

## Non-negotiable truth boundary

- Do not claim production, autonomous, provider, browser, sandbox, or deployment readiness without evidence.
- If proof is missing, status must be `PROOF_REQUIRED`, `PARTIAL`, or `BLOCKED`.
- Do not use external platform names as our product claim.
- User benefit comes first: the output must be usable, testable, and visibly tied to evidence.
- Empty diagnostic output is not proof of success.
- A failed evaluator, missing exit code, broken linter, broken test runner, or unknown tool state blocks repair and release.

## Core deterministic pipeline

### T0 Input Lock

Freeze the input before work starts:

- user goal
- repository branch/head
- relevant files
- constraints
- test commands
- expected evidence

Output: immutable run id or proof hash.

### T1 Dependency Graph Build

Convert work into a DAG:

- independent lanes
- dependent lanes
- write-conflict domains
- serial-only gates

No task may skip a hard dependency.

### T2 Parallel Execute

Run independent work as parallel lanes where possible:

- isolate write scopes per lane
- avoid shared mutable state
- do not merge unverified lane output
- prefer small, evidence-bearing commits

### T3 Deterministic Merge

Merge outputs only with stable ordering:

1. normalize output
2. sort by `(stage, topo_index, task_id)`
3. merge with explicit conflict log
4. compute proof hash
5. replay merge once; hash must match

If replay hash mismatches, stop.

### T4 Verification Gate

Before merge or deploy:

- lint/typecheck/build proof
- smoke script proof
- route/API smoke proof where relevant
- auth boundary proof for privileged routes
- claim downgrade if any proof is missing
- inherited-blindness guard proof
- independent verifier proof for repair promotion

## Inherited-blindness guard

Self-repair must not trust a broken evaluator.

Blocked states:

- diagnostic tool missing
- exit code unknown
- stdout and stderr both empty
- command empty
- non-zero diagnostic exit
- repair attempted after untrusted diagnostic output

Required behavior:

- stop repair immediately
- restore or replace the diagnostic toolchain
- collect independent verifier proof before any release or repair-promotion claim
- never interpret silence as success

## Independent verifier rule

For repair or release promotion, at least one verifier must differ from the source tool.

Examples:

- source tool: local lint, independent verifier: CI lint
- source tool: local build, independent verifier: Vercel build
- source tool: agent repair result, independent verifier: human review or secondary toolchain

The independent verifier must include:

- verifier id
- target run id
- source tool
- independent tool
- verdict
- evidence reference
- observation time

## DSG 5-lane autonomous runtime work

Use these as independent-but-gated lanes:

### Lane 1: sandbox_isolation

Goal: run commands in a real isolated provider.

Required proof:

- provider id
- job id
- command
- exit code
- duration
- log ref
- artifact refs
- proof hash

If missing: `PROOF_REQUIRED`.

### Lane 2: agent_repair_loop

Goal: bounded plan-act-observe-repair-verify loop.

Required proof:

- failed command
- diagnosis
- patch ref
- retry command
- attempt count
- stop reason
- passing retry proof or explicit fail-closed proof
- inherited-blindness gate must pass
- independent verifier proof must pass

If missing: `PROOF_REQUIRED`.

### Lane 3: remote_browser_session

Goal: actual remote browser/computer session proof.

Required proof:

- provider id
- session id
- start URL
- navigation log
- screenshot refs
- takeover checkpoints
- proof hash

If missing: `PROOF_REQUIRED`.

### Lane 4: artifact_timeline

Goal: one user-visible proof ledger.

Required proof:

- timeline id
- job id
- ordered events
- artifact refs
- event proof hashes
- claim boundary

If missing: `PROOF_REQUIRED`.

### Lane 5: preview_deployment_proof

Goal: prove preview URL before claim promotion.

Required proof:

- deployment URL
- provider status
- route status list
- body hash or screenshot ref
- proof hash

If missing: `PROOF_REQUIRED`.

## Working mode

For each user request:

1. Verify real files, errors, branch, and command output before claiming.
2. Lock the target outcome from the user perspective.
3. Treat unverified new data as pending.
4. Use accumulated test/build/deploy evidence.
5. Return the user benefit, current status, and exact next command.

## Claim ladder

Use this ladder only:

1. `PLANNED_ONLY`
2. `IMPLEMENTED_UNVERIFIED`
3. `LOCAL_VERIFIED`
4. `DEPLOYED_BUILD_SUCCESS`
5. `PRODUCTION_SMOKE_VERIFIED`
6. `DSG_AUTONOMOUS_LEVEL_PARTIAL`
7. `DSG_AUTONOMOUS_LEVEL_COMPLETE`

`DSG_AUTONOMOUS_LEVEL_COMPLETE` is allowed only when all five lanes have real provider proof and the production route reports complete.

## Stop conditions

Stop and report blocked if:

- missing provider proof
- route should be protected but returns public success
- build or typecheck fails
- merge replay hash differs
- branch state is unknown
- a claim would exceed evidence
- diagnostic output is empty and exit state is unknown
- linter/test/build runner is broken
- repair loop lacks independent verifier proof
- repair loop tries to modify code after untrusted diagnostics

## Default local verification commands

```bash
npm run lint
npm run dsg:typecheck
node scripts/dsg-autonomous-parallel-work-smoke.mjs
node scripts/dsg-autonomous-level-gate-smoke.mjs
npm run build:termux
```

## Default production smoke commands

```bash
BASE="https://dsg-one-v1.vercel.app"

for p in /dsg/autonomous-level /api/dsg/autonomous-level/status /dsg/flow-studio /api/dsg/flow-studio/config; do
  code=$(curl -L -s -o /tmp/dsg-skill-check.html -w "%{http_code}" "$BASE$p")
  echo "$code $p"
done
```
