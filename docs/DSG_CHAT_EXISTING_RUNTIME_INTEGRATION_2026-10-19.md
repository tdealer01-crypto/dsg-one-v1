# DSG ONE — Chat history and existing runtime integration

## Goal

User-facing `/dsg/workroom`: **one chat → agent works → live results**, refresh-safe.
Avoid another memory store, authorization gateway, agent-framework, physics solver,
or fake AI model. Use the existing AWS-only stack.

## Existing canonical components (not duplicated by this change)

| Existing component | Actual source / role | Change in this PR |
|---|---|---|
| Microsoft Agent Framework 1.18.0 | `automation_spacetime/engine.py` and `checkpoint_store.py`; DAG executor/checkpoint and proposal workflow | None; existing runtime |
| DSG Persistent Memory | `lib/dsg/server/memory/repository.ts`; Supabase `api.dsg_memory_events` | **Read** previously stored conversation events for the same verified actor and workspace; reuse existing write path |
| AWS Workroom Durable Memory | Private Runtime `src/dsg_spacetime/workroom_memory_local.py`; governed per-principal job lifecycle on durable volume | None; distinct from the website's conversation transcript |
| DSG-Agent-v0 Qwen | AWS `node.agent.dsg-v0` with `route.agent.dsg-v0.plan` and `action.plan` | No false chat binding; planning must still follow the existing authenticated AWS governed route |
| Core Spin + Physics Kernel | Private Runtime Core Spin, Z3/QUBO/Ising feasibility and selection | None; apply where governed plan/selection calls use these stages, not to conversational rendering |
| AWS Spacetime | `https://aws.dsg.pics/mcp`, governed plan/approval/execute/evidence | Unchanged authority; no duplicate gate |

**Critical boundary**: the current `POST /api/dsg/agent-chat` is an
ordinary model-answer endpoint. Neither `POST /api/dsg/jobs` (stores job)
nor a successful chat reply proves Microsoft Agent Framework, Qwen v0,
Core Spin, provider Execute or signed Evidence actually ran. The existing
`/api/dsg/jobs/[jobId]/runtime/start` endpoint checks a gate and returns
`START_ALLOWED`; it does **not** start a worker itself. Do not claim an
end-to-end agent based on the UI alone.

## Fixed now

- GET `/api/dsg/agent-chat` is authenticated with the existing
  `requireVerifiedDsgActor('job:read')` and reads the **same**
  `dsg_memory_events` records already persisted by
  `persistAgentChatTurn`, filtering by **both** trusted workspace/actor IDs.
  No new database migration/table or memory engine.
- Workroom hydrates these turns when opened, retaining ongoing local messages
  instead of losing them on refresh. The conversation composer stays enabled.
- A memory outage returns `DSG_CHAT_HISTORY_UNAVAILABLE` (503); never fake
  a zero-message history. When memory ingestion fails, the UI shows a warning.
- Chat model: first use the already-supported OpenAI-compatible adapter if
  `OPENAI_API_KEY` is bound; otherwise use a server-configured Gemini
  text model if `GEMINI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY` is
  already bound. Neither path exposes credentials in the browser. The UI
  displays the actual model/provider from a successful response.
- The presence of `DSG-Agent-v0` as an `action.plan` route is **not**
  treated as an available natural-language Chat API. The fallback text
  is explicitly marked `modelStatus: unavailable`.
- Model connection diagnostics indicate **configuration only**, not
  successful inference; actual inference is confirmed only by a response.

## What is **not** activated by this PR

- No automatic dispatch from stored `dsg_jobs` to Microsoft Agent
  Framework / AWS Core Spin / provider execution.
- No new DSG Agent v0 Qwen chat inference endpoint, and no claim that a
  Kaggle worker is currently live.
- No background automatic conversation saving if the existing Supabase
  memory service is unavailable: report the error and repair the original
  service configuration instead.
- No changes to approval policies, OAuth clients, or extra step-up prompts.
- No change to Z3, Ising, QUBO, checkpoint or Workroom AWS memory semantics.

## Acceptance

Run `npx vitest run tests/dsg/chat-history-model.test.ts tests/dsg/chat-history-recovery-route.test.ts`,
`npm run dsg:typecheck`, and `npm run lint`.

For **Production LIVE_E2E** verify, using one real existing login session:
1. Send two messages, including a second message before the first finishes.
2. Observe a response with real `model`/`provider`, and `fallback:false`.
   If the provider is unconfigured, report the exact error without a false AI claim.
3. Refresh; GET history must retrieve both actual user and AI turns, preserving
   order and only the verified actor/workspace.
4. Confirm failure of memory persistence is visible, and no other actor's
   conversation is returned.
5. Separately, for work objectives, verify Microsoft Framework → DSG v0
   action.plan → Core Spin/Physics → AWS Spacetime → actual provider execution
   → signed evidence. That full path remains **UNVERIFIED** by this PR.

## Status

SOURCE_CHANGED after this branch is pushed; TESTED only when exact-head CI
passes; DEPLOYED only when merged exact-main image is built, scanned,
promoted and public SHA read back; LIVE_E2E requires actual user session
evidence. No project-level "ACTIVATED ALL" claim.
