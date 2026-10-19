# CLAUDE.md — DSG One v1 Agent Rules

Read `AGENTS.md` first — especially the middleware critical rule and the AWS migration truth boundary.

## Tech stack

- Next.js 15 App Router, React 19, TypeScript
- Supabase via `lib/dsg/server/supabase-rpc.ts` — use `readDsgRest` / `callDsgRpc`
- Auth via `requireVerifiedDsgActor(req.headers, permission)` from `lib/dsg/server/context.ts`
- `lib/utils.ts` exists — `cn()` from `clsx` + `tailwind-merge` is available
- `lucide-react` and `recharts` are installed
- **No `@supabase/ssr`** — package is not installed, do not import it

## CRITICAL: Middleware rule

Never use any Supabase library in `middleware.ts`.
No `createClient`, no `@supabase/ssr`, no `createServerClient`.
Validate JWT using native browser APIs only:
```ts
const [, payload] = token.split('.');
const { exp } = JSON.parse(atob(payload));
if (Date.now() / 1000 > exp) { /* expired */ }
```

## Tool policy

**Allowed:**
- Inspect any repository file
- Create `claude/*` branches and open pull requests
- Run `npm run build`, `npx tsc --noEmit`
- Run `node scripts/dsg-next-build.mjs` if available
- Push to `claude/*` branches
- Create Supabase migration files under `supabase/migrations/`

**Blocked:**
- Do not commit secrets, tokens, API keys, Supabase keys, provider deployment tokens, or Claude credentials
- Do not push directly to `main` without explicit user approval or instruction
- Do not claim production-ready without live HTTP evidence plus provider deployment/commit evidence
- Do not auto-merge pull requests
- Do not import `@supabase/ssr` anywhere in this repo
- Do not add Supabase library calls to `middleware.ts`
- Do not reintroduce Vercel, Render, Railway, or silent Azure fallbacks; AWS is the active runtime migration target and no public runtime URL may be invented before verified cutover
- Do not put server secrets, Stripe webhooks, Z3/Ising execution, or privileged runtime actions into Framer client code

## Required PR evidence

Every pull request description must include:

| Field | Content |
|---|---|
| **Goal** | What problem this PR solves |
| **Files changed** | List with one-line reason per file |
| **Commands run** | Exact commands + summary of output |
| **Pass/fail** | Build + typecheck status |
| **Known limits** | What is NOT covered by this PR |
| **User-visible benefit** | What users gain after merge |
| **Next step** | What must happen after merge |

## Common patterns

### Auth in API routes
```ts
import { requireVerifiedDsgActor } from '@/lib/dsg/server/context';

export async function GET(req: NextRequest) {
  const actor = await requireVerifiedDsgActor(req.headers, 'read:history');
  // actor.actorId = user UUID
}
```

### Read rows scoped to current user
```ts
import { getDsgSupabaseRpcConfig, readDsgRest } from '@/lib/dsg/server/supabase-rpc';

const config = getDsgSupabaseRpcConfig();
const rows = await readDsgRest<MyRow[]>(config, 'table_name', {
  select: '*',
  user_id: `eq.${actor.actorId}`,
  order: 'created_at.desc',
});
```

### Next.js 15 async params (required — will type-error otherwise)
```ts
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
}
```

### No mock fallbacks
All API routes must return HTTP 500 on Supabase error. No static arrays.
```ts
try {
  const data = await readDsgRest(...);
  return NextResponse.json({ ok: true, data });
} catch (err) {
  return NextResponse.json({ error: String(err) }, { status: 500 });
}
```

## Client stores (`store/`)

All browser-persistent shared state lives in `store/`. Import from the barrel:

```ts
import { useChecklist, useAppLanguage, checklistStore, languageStore } from '@/store';
```

### Available hooks

| Hook | Returns | Use when |
|---|---|---|
| `useChecklist()` | `{ dismissed, completedSteps, dismiss, restore, completeStep, uncompleteStep, toggleStep }` | onboarding widget หรือ settings page |
| `useAppLanguage(default?)` | `'th' \| 'en'` | component ที่ต้องรู้ภาษาปัจจุบัน |

### Available stores (raw — ใช้เมื่อเรียกนอก component)

| Store | Key methods |
|---|---|
| `checklistStore` | `.getSnapshot()` `.update(patch)` `.subscribe(cb)` |
| `languageStore` | `.getSnapshot()` `.setLanguage(lang)` `.subscribe(cb)` |

### Rules สำหรับ store ใหม่

- สร้างไฟล์ใน `store/` เสมอ ไม่ใช้ useState + useEffect สำหรับ localStorage
- export hook convenience ใน `store/useXxx.ts` แล้วเพิ่มใน `store/index.ts`
- `getSnapshot` ต้องคืน stable reference (cache + freeze)
- `subscribe` ต้องลงทะเบียน window listener แค่ครั้งเดียว (lazy mount/unmount pattern)
- ห้าม setState ใน useEffect — ใช้ `useSyncExternalStore` แทน

## Production control loop

### Current hosting boundary (updated 2026-10-19)
- DSG ONE public website/app: `https://dsg.pics`; AWS immutable website image `f6a1e11b1b485a4d5b3d3e53f95be0bcaa0b76ad`, digest `sha256:ccc7908229d595ee60597ebb202bcfe56ebbd4f3a309ed00c44ca01e845b3d19`; [Build #39248381900](https://github.com/tdealer01-crypto/dsg-one-v1/actions/runs/39248381900) and [Ship #39248645333](https://github.com/tdealer01-crypto/dsg-one-v1/actions/runs/39248645333) verified public source serving
- Framer, when present, is public presentation only; never privileged execution authority
- **Separate governed execution transport:** `https://aws.dsg.pics/mcp` (OAuth-protected MCP), not a REST API origin for website endpoints; no MCP container deployment or T0-T4 provider E2E is proven by this website release
- Skill source `skills/dsg-autonomous-execution/SKILL.md` is packaged in the website image via `Dockerfile`; it is **not** automatically a registered/executable MCP tool
- Canonical release evidence: [docs/DSG_AUTONOMOUS_SKILL_AWS_RELEASE_20261019.md](docs/DSG_AUTONOMOUS_SKILL_AWS_RELEASE_20261019.md)
- Azure App Service / Render / Vercel: historical or retired; no production fallback

Render (`dsg-one-v1-aimo.onrender.com`) was an earlier migration target
(see `docs/FRAMER_RENDER_MIGRATION.md`, superseded) and is not the current
production runtime — verified dead (`HTTP 503`) on 2026-09-24. Several
scripts, workflow env defaults, and fallback URL constants elsewhere in this
repo still point at the Render origin; treat those as stale unless you
re-verify them, not as evidence Render is live.

### Check if production is alive
For the DSG ONE **website** only, check `https://dsg.pics/api/agent/status` and require `ok: true`, the exact deployment `version` and bound ECR image digest. The 19 October 2026 ship proof identifies source `f6a1e11b1b485a4d5b3d3e53f95be0bcaa0b76ad`. A new release must update this source via its own exact-SHA proof; a historical check is not proof of current health. For Spacetime MCP execution, verify authenticated route discovery, plan/approval, provider receipts and tamper-evident evidence separately. Never fall back to Azure or Render.

### Ship from chat (triggers CI → verify)
Use GitHub MCP tool `mcp__github__create_dispatch_event` or trigger workflow_dispatch on `.github/workflows/ship.yml` with input `reason: "<what you did>"`.

### Full loop
1. Write code → commit → push to claude/* branch
2. Open PR; merge only after required verification and approval policy are satisfied
3. Build and scan the immutable AWS image from `main`
4. Verify the AWS ECR source-SHA tag/digest binding and release-manifest status
5. Deploy only through the governed AWS runtime path after the security/cost gates pass
6. Treat the Azure deployment workflow as historical/manual rollback proof only; never use an Azure PASS as current AWS production evidence

