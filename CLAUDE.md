# CLAUDE.md — DSG One v1 Agent Rules

Read `AGENTS.md` first — especially the middleware critical rule and the Azure App Service production boundary.

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
- Do not reintroduce Vercel, Render, or Railway as a production fallback; Azure App Service `dsg-one-v1` is the only production runtime path
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

### Current hosting boundary
- Public presentation layer: Framer
- DSG application/runtime/API: Azure App Service `dsg-one-v1`
- Production runtime origin: `https://dsg-one-v1.azurewebsites.net`

Render (`dsg-one-v1-aimo.onrender.com`) was an earlier migration target
(see `docs/FRAMER_RENDER_MIGRATION.md`, superseded) and is not the current
production runtime — verified dead (`HTTP 503`) on 2026-09-24. Several
scripts, workflow env defaults, and fallback URL constants elsewhere in this
repo still point at the Render origin; treat those as stale unless you
re-verify them, not as evidence Render is live.

### Check if production is alive
GET https://dsg-one-v1.azurewebsites.net/api/agent/status

### Ship from chat (triggers CI → verify)
Use GitHub MCP tool `mcp__github__create_dispatch_event` or trigger workflow_dispatch on `.github/workflows/ship.yml` with input `reason: "<what you did>"`.

### Full loop
1. Write code → commit → push to claude/* branch
2. Open PR; merge only after required verification and approval policy are satisfied
3. Build and scan the immutable AWS image from `main`
4. Verify the AWS ECR source-SHA tag/digest binding and release-manifest status
5. Deploy only through the governed AWS runtime path after the security/cost gates pass
6. Treat the Azure deployment workflow as historical/manual rollback proof only; never use an Azure PASS as current AWS production evidence

