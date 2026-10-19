# DSG Autonomous Execution — AWS Website Release Evidence (2026-10-19)

**Scope:** production deployment of the `dsg-one-v1` **website/app container**, which now includes `skills/dsg-autonomous-execution/SKILL.md` as a packaged file. This is **not** a release or full execution proof for the separate DSG Spacetime MCP service.

## Verified release identity

| Field | Observed value | Evidence |
| --- | --- | --- |
| Repo | `tdealer01-crypto/dsg-one-v1` | [GitHub repository](https://github.com/tdealer01-crypto/dsg-one-v1) |
| Source/frontmatter fix | PR [#224](https://github.com/tdealer01-crypto/dsg-one-v1/pull/224), merged as `6d465092b3ef9e07383198631c3476b38b02b637` | PR and main commit |
| Immutable image packaging/build trigger | PR [#225](https://github.com/tdealer01-crypto/dsg-one-v1/pull/225), merged as `f6a1e11b1b485a4d5b3d3e53f95be0bcaa0b76ad` | PR and main commit |
| Production source SHA | `f6a1e11b1b485a4d5b3d3e53f95be0bcaa0b76ad` | [AWS build run #39248381900](https://github.com/tdealer01-crypto/dsg-one-v1/actions/runs/39248381900) |
| ECR repository / region | `121205961822.dkr.ecr.us-east-1.amazonaws.com/dsg-one-v1-prod` / `us-east-1` | AWS ECR DescribeImages readback, 2026-10-19 |
| Immutable image digest | `sha256:ccc7908229d595ee60597ebb202bcfe56ebbd4f3a309ed00c44ca01e845b3d19` | ECR readback, image tag equals source SHA |
| ECR image scan | `COMPLETE`, production critical-findings gate passed | [Build #39248381900](https://github.com/tdealer01-crypto/dsg-one-v1/actions/runs/39248381900); AWS DescribeImageScanFindings |
| Source/digest handoff | SSM `/dsg/one/prod/image-source-sha` and `/dsg/one/prod/image-digest`, both version **59**, matched exact source/digest | AWS SSM GetParameter readback |
| Deployment target | Already-running EC2 `i-01a2ee90890a558c3` | AWS EC2 and SSM readback |
| On-host governed release | `DSG-ONE-Existing-EC2-Release-v1`, SSM Command `ca0fdb4d-88b2-4284-99a0-4e13f780e9c3`, `Success`, response code `0` | [Ship #39248645333](https://github.com/tdealer01-crypto/dsg-one-v1/actions/runs/39248645333); SSM GetCommandInvocation |
| Public URL | `https://dsg.pics` | Ship external readback of `/api/agent/status` |
| Public served revision | `DSG_ONE_PUBLIC_SERVING=VERIFIED_COMPLETED`, exact source SHA `f6a1e11b1b485a4d5b3d3e53f95be0bcaa0b76ad` | [Ship #39248645333](https://github.com/tdealer01-crypto/dsg-one-v1/actions/runs/39248645333) |
| Ship verdict | `completed / success` (2026-10-19 12:00:27 UTC) | GitHub Actions run |

**Release result:** the DSG ONE website/app image was rebuilt, security-gated, promoted on the existing EC2 host and independently verified on the public HTTPS status route. No new EC2, GPU, ECS, ALB or NAT infrastructure was started by this release workflow.

## T0–T4 skill packaging and semantics

The packaged source is [`skills/dsg-autonomous-execution/SKILL.md`](../skills/dsg-autonomous-execution/SKILL.md). It now contains the required YAML `name` and `description` frontmatter. The release packaging contract is represented in the repository `Dockerfile` by a `COPY --from=builder` of this file into the final image, followed by a frontmatter assertion. A path filter for `skills/dsg-autonomous-execution/**` was added to the [AWS image build workflow](../.github/workflows/build-aws-dsg-one.yml) so subsequent skill edits cannot silently miss the image-build trigger.

| Stage | Contract | Deployment evidence boundary |
| --- | --- | --- |
| **T0** Input Lock | Freeze goal, source HEAD, constraints, commands, evidence; produce immutable run identity | Skill contract **SOURCE_FOUND**; governed live run **NOT_VERIFIED** |
| **T1** Dependency Graph | Build deterministic DAG, dependencies, write conflicts, serial gates | Skill contract **SOURCE_FOUND**; governed live run **NOT_VERIFIED** |
| **T2** Parallel Execute | Execute independent lanes with isolated writes and provider receipts | Skill contract **SOURCE_FOUND**; governed live run **NOT_VERIFIED** |
| **T3** Deterministic Merge | Stable ordering, conflict log, proof hash and replay match | Skill contract **SOURCE_FOUND**; governed live run **NOT_VERIFIED** |
| **T4** Verification Gate | Lint/typecheck/build, route/auth proofs, independent verifier and evidence checks | Release CI **PASS**; end-to-end governed tool/evidence validation **NOT_VERIFIED** |

PR #225 passed 6/6 pull-request checks including independent Docker image verification. The merged release SHA passed 5/5 required main-branch CI jobs and the AWS image-build and Ship workflows. These are **build and deployment proofs**, not T0–T4 execution receipts.

## Separate website and Spacetime authority

- `https://dsg.pics`: DSG ONE website, authenticated UI, application routes and `/api/agent/status` source/digest health readback.
- `https://aws.dsg.pics/mcp`: separately deployed, OAuth-protected **DSG Spacetime MCP** governance/plan/approval/provider/evidence transport. This address is **not** a REST base URL for `/dsg/*` or `/api/dsg/*` paths.
- The obsolete Render URL and the retired control-plane deployment must not be used as current DSG runtime fallbacks. No change to the AWS Spacetime MCP container or its route registration was established by PRs #224 or #225.
- Packaging `SKILL.md` in the website container **does not automatically register an executable MCP tool**, change connector scopes, grant permission, or make `POST /api/agent-skills/run` a real provider executor. Inspect the runtime implementation and require independent receipts; do not infer execution from the file's presence.

## Acceptance ladder (as of this release)

| State | Verdict |
| --- | --- |
| Skill frontmatter and T0–T4 source on main | **PASS** |
| Release image contains skill file and future skill changes trigger its build | **PASS** (Docker image CI + workflow source) |
| Exact-source immutable ECR build, critical scan and SSM identity | **PASS** |
| Existing-EC2 promote and public serving SHA | **PASS** |
| Authenticated MCP skill discovery and actual tool contract | **NOT_VERIFIED** |
| One plan-bound T0→T4 provider run with real receipts, deterministic merge replay, approvals when required and independently verified evidence | **NOT_VERIFIED** |
| Autonomous-level all-five-lane production E2E | **NOT_VERIFIED** |
| Whole-system DSG ONE / Cinema / Quest / Marketplace E2E | **NOT_VERIFIED** |

**Next action:** from the authenticated AWS Spacetime MCP session, discover the actual available Route/Node contracts; if a T0–T4 execution route exists, bind a plan and execute a bounded owner-authorized run, then verify the exact provider result, chain and replay. If the route is absent, mark `BLOCKED` with its exact missing capability—do not simulate or claim autonomous completion.

## Operational notes

The SSM on-host command's stderr contained a Docker Compose warning about other project containers being orphans and a transient `curl: (56) Recv failure: Connection reset by peer` during container replacement. The SSM command **ended Success / 0**, logged `DSG_ONE_ON_HOST_RELEASE=PASS`, and the subsequent independent public SHA verification succeeded. The warnings do not constitute a failure, nor are they evidence that unrelated Cinema, Desktop or Spacetime services were updated.

Future deployments should retain the [`ship.yml`](../.github/workflows/ship.yml) exact-main CI gate, pinned SSM release-document hash, immutable ECR identity, already-running EC2 requirement, rollback preparation and public source readback. Avoid unverified "all production activated" claims.
