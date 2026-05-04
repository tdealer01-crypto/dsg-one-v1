# DSG App Builder Runtime Proof

## Purpose

Track whether the DSG App Builder runtime has executed end-to-end after plan gate and approval.

Deployment proof and runtime proof are different:

- Deployment proof means the web app deployed.
- Runtime proof means the App Builder tool actually ran and produced evidence.

## Target runtime path

1. Lock goal
2. Generate PRD and proposed plan
3. Run plan gate
4. Record approval
5. Create runtime handoff
6. Launch `dsg.app_builder.launch_agent_runtime`
7. Create runtime environment manifest
8. Return action-layer contract
9. Create generated full-stack PR output
10. Write DB-backed tool audit
11. Show UI notification/result

## Evidence checklist

| Evidence | Status |
|---|---|
| Vercel production deployment is READY | observed |
| App Builder job created from live UI/API | pending |
| PRD and plan generated | pending |
| Plan gate result visible | pending |
| Approval hash recorded | pending |
| Runtime handoff returned | pending |
| `launch_agent_runtime` executed | pending |
| Runtime environment manifest written | pending |
| Action-layer contract returned | pending |
| GitHub PR created by tool | pending |
| `dsg_app_builder_tool_audits` row written | pending |
| UI notification/result visible | pending |
| CI/typecheck/build passed | pending |
| Deployment proof linked | pending |
| Production-flow proof passed | pending |

## Claim boundary

Allowed after PR evidence only:

```txt
IMPLEMENTED_UNVERIFIED
```

Blocked until full proof exists:

```txt
DEPLOYABLE
PRODUCTION_VERIFIED
```

## Update rule

Do not mark runtime verified until the live run produces job id, approval hash, handoff hash, manifest path, PR URL, audit evidence, and UI result evidence.
