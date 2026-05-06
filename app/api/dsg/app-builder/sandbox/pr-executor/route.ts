import { NextResponse } from 'next/server';
import { sha256, truthBoundary, userBenefitGate, verify } from '@/lib/dsg/app-builder/agent-runtime/decision-frame';
import { evaluateCommandGate, evaluatePathGate, evaluateSecretBoundary, makeAgentBranchName } from '@/lib/dsg/app-builder/agent-runtime/sandbox-gates';
import { getDevAppBuilderContext } from '@/lib/dsg/server/app-builder/context';
import { recordAppBuilderToolAudit } from '@/lib/dsg/server/app-builder/repository';

type GitHubRef = { object: { sha: string } };
type GitHubContent = { sha?: string };
type GitHubPullRequest = { number: number; html_url: string; head: { sha: string; ref: string } };

type FileWrite = { path: string; content: string };

type ExecutorInput = {
  jobId?: string;
  goal?: string;
  appId?: string;
  dryRun?: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function fail(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : 'PR_EXECUTOR_FAILED';
  return NextResponse.json({ ok: false, error: { code: message, message } }, { status });
}

function repoConfig() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.DSG_BUILDER_GITHUB_OWNER || 'tdealer01-crypto';
  const repo = process.env.DSG_BUILDER_GITHUB_REPO || 'dsg-one-v1';
  const baseBranch = process.env.DSG_BUILDER_BASE_BRANCH || 'main';
  if (!token) throw new Error('GITHUB_TOKEN_REQUIRED_FOR_PR_EXECUTOR');
  return { token, owner, repo, baseBranch, repoFullName: `${owner}/${repo}` };
}

function safeId(value: string, fallback: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || fallback;
}

async function github<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { token, owner, repo } = repoConfig();
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28',
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = typeof data?.message === 'string' ? data.message : response.statusText;
    throw new Error(`GITHUB_${response.status}_${message}`);
  }
  return data as T;
}

async function tryGetContentSha(path: string, branch: string): Promise<string | undefined> {
  try {
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const content = await github<GitHubContent>(`/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`);
    return content.sha;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('GITHUB_404')) return undefined;
    throw error;
  }
}

function generatedPage(appId: string, title: string) {
  return [
    "'use client';",
    '',
    "import { useEffect, useState } from 'react';",
    '',
    "type Item = { id: string; title: string; completed: boolean; created_at: string };",
    `const APP_ID = ${JSON.stringify(appId)};`,
    `const APP_TITLE = ${JSON.stringify(title)};`,
    '',
    'export default function GeneratedAgentAppPage() {',
    "  const [items, setItems] = useState<Item[]>([]);",
    "  const [title, setTitle] = useState('');",
    "  const [status, setStatus] = useState('Ready');",
    '',
    '  async function loadItems() {',
    "    setStatus('Loading backend evidence…');",
    "    const res = await fetch('/api/generated-apps/' + APP_ID + '/items', { cache: 'no-store' });",
    '    const json = await res.json();',
    "    if (!res.ok || !json.ok) throw new Error(json.error?.message || 'LOAD_FAILED');",
    '    setItems(json.data.items);',
    "    setStatus('Backend API + database reachable');",
    '  }',
    '',
    '  async function addItem() {',
    '    const value = title.trim();',
    "    if (!value) return setStatus('Title required');",
    "    const res = await fetch('/api/generated-apps/' + APP_ID + '/items', {",
    "      method: 'POST',",
    "      headers: { 'content-type': 'application/json' },",
    '      body: JSON.stringify({ title: value }),',
    '    });',
    '    const json = await res.json();',
    "    if (!res.ok || !json.ok) throw new Error(json.error?.message || 'CREATE_FAILED');",
    "    setTitle('');",
    '    await loadItems();',
    '  }',
    '',
    '  useEffect(() => {',
    "    loadItems().catch((error) => setStatus(error instanceof Error ? error.message : 'LOAD_FAILED'));",
    '  }, []);',
    '',
    '  return (',
    '    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8 md:py-10">',
    '      <div className="mx-auto max-w-4xl space-y-6">',
    '        <section className="rounded-3xl border border-indigo-500/30 bg-indigo-500/10 p-6 shadow-2xl shadow-indigo-950/30">',
    '          <p className="text-xs font-bold uppercase tracking-[0.24em] text-indigo-200">DSG Agent Generated App</p>',
    '          <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">{APP_TITLE}</h1>',
    '          <p className="mt-4 text-sm leading-7 text-slate-300">Generated through the gated PR executor. Production claim remains blocked until build, deploy, database, and live proof pass.</p>',
    '        </section>',
    '        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5">',
    '          <div className="flex flex-col gap-3 md:flex-row">',
    '            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Add a database-backed item" className="min-h-12 flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-4 text-sm text-white outline-none focus:border-indigo-500" />',
    '            <button onClick={() => addItem().catch((error) => setStatus(error instanceof Error ? error.message : \'CREATE_FAILED\'))} className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white hover:bg-indigo-500">Add item</button>',
    '          </div>',
    '          <p className="mt-4 text-sm text-slate-400">{status}</p>',
    '          <div className="mt-5 space-y-3">',
    '            {items.map((item) => (',
    '              <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">',
    '                <p className="font-semibold text-slate-100">{item.title}</p>',
    '                <p className="mt-1 text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</p>',
    '              </div>',
    '            ))}',
    '            {!items.length && <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-500">No rows yet.</div>}',
    '          </div>',
    '        </section>',
    '      </div>',
    '    </main>',
    '  );',
    '}',
  ].join('\n');
}

function generatedApi(appId: string) {
  return [
    "import { NextResponse } from 'next/server';",
    '',
    "type SupabaseRequest = { method?: 'GET' | 'POST'; path: string; query?: string; body?: unknown };",
    "type ItemRow = { id: string; app_id: string; title: string; completed: boolean; created_at: string };",
    `const APP_ID = ${JSON.stringify(appId)};`,
    '',
    'function supabaseConfig() {',
    '  const url = process.env.SUPABASE_URL;',
    '  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;',
    "  if (!url || !key) throw new Error('GENERATED_APP_SUPABASE_ENV_REQUIRED');",
    "  return { url: url.endsWith('/') ? url.slice(0, -1) : url, key };",
    '}',
    '',
    'async function supabaseRest<T>(input: SupabaseRequest): Promise<T> {',
    '  const { url, key } = supabaseConfig();',
    '  const response = await fetch(`${url}/rest/v1/${input.path}${input.query ?? \'\'}`, {',
    '    method: input.method ?? \'GET\',',
    '    headers: { apikey: key, authorization: `Bearer ${key}`, \'content-type\': \'application/json\', prefer: \'return=representation\' },',
    '    body: input.body === undefined ? undefined : JSON.stringify(input.body),',
    '  });',
    '  const text = await response.text();',
    '  const data = text ? JSON.parse(text) : null;',
    '  if (!response.ok) throw new Error(typeof data?.message === \'string\' ? data.message : response.statusText);',
    '  return data as T;',
    '}',
    '',
    'function fail(error: unknown) {',
    "  const message = error instanceof Error ? error.message : 'GENERATED_APP_REQUEST_FAILED';",
    '  return NextResponse.json({ ok: false, error: { code: message, message } }, { status: 400 });',
    '}',
    '',
    'export async function GET() {',
    '  try {',
    '    const rows = await supabaseRest<ItemRow[]>({',
    "      path: 'generated_app_items',",
    '      query: `?app_id=eq.${encodeURIComponent(APP_ID)}&select=id,title,completed,created_at&order=created_at.desc`,',
    '    });',
    '    return NextResponse.json({ ok: true, data: { appId: APP_ID, items: rows } });',
    '  } catch (error) {',
    '    return fail(error);',
    '  }',
    '}',
    '',
    'export async function POST(req: Request) {',
    '  try {',
    '    const body = (await req.json()) as { title?: string };',
    '    const title = body.title?.trim();',
    "    if (!title) throw new Error('GENERATED_APP_TITLE_REQUIRED');",
    '    const rows = await supabaseRest<ItemRow[]>({ method: \'POST\', path: \'generated_app_items\', body: { app_id: APP_ID, title, completed: false } });',
    '    return NextResponse.json({ ok: true, data: { item: rows[0] } });',
    '  } catch (error) {',
    '    return fail(error);',
    '  }',
    '}',
  ].join('\n');
}

function migration(appId: string) {
  return [
    `-- DSG generated app migration for ${appId}`,
    'create table if not exists public.generated_app_items (',
    '  id uuid primary key default gen_random_uuid(),',
    '  app_id text not null,',
    '  title text not null,',
    '  completed boolean not null default false,',
    '  created_at timestamptz not null default now()',
    ');',
    'create index if not exists generated_app_items_app_id_created_at_idx on public.generated_app_items (app_id, created_at desc);',
  ].join('\n');
}

function runbook(appId: string, goal: string) {
  return [
    `# DSG Agent Generated App: ${appId}`,
    '',
    `Goal: ${goal}`,
    '',
    '## Truth boundary',
    '',
    '- This PR is implementation evidence only until CI/build/deploy/live proof passes.',
    '- Production-ready claim is blocked by default.',
    '- Generated paths are constrained by DSG sandbox allowlists.',
    '',
    '## Routes',
    '',
    `- App: /generated-apps/${appId}`,
    `- API: /api/generated-apps/${appId}/items`,
    '',
    '## Required checks',
    '',
    '- npm run dsg:typecheck',
    '- npm run build:termux or npm run build',
    '- open generated app preview',
    '- verify GET and POST database path',
  ].join('\n');
}

function buildFiles(appId: string, goal: string): FileWrite[] {
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const title = goal.slice(0, 80) || 'Generated DSG app';
  return [
    { path: `app/generated-apps/${appId}/page.tsx`, content: generatedPage(appId, title) },
    { path: `app/api/generated-apps/${appId}/items/route.ts`, content: generatedApi(appId) },
    { path: `supabase/migrations/${timestamp}_create_generated_app_items_${appId.slice(0, 12)}.sql`, content: migration(appId) },
    { path: `docs/dsg-generated-apps/${appId}.md`, content: runbook(appId, goal) },
  ];
}

export async function POST(req: Request) {
  try {
    const input = (await req.json().catch(() => ({}))) as ExecutorInput;
    const goal = String(input.goal || '').trim();
    const jobId = safeId(String(input.jobId || 'agent-pr'), 'agent-pr');
    const appId = safeId(String(input.appId || jobId), 'generated-app');
    const dryRun = input.dryRun !== false;

    if (!goal) throw new Error('APP_BUILDER_GOAL_REQUIRED');

    const files = buildFiles(appId, goal);
    const paths = files.map((file) => file.path);
    const commands = ['npm run dsg:typecheck', 'npm run build:termux'];
    const inputHash = sha256(JSON.stringify({ goal, jobId, appId, paths, commands }));
    const verified = verify({ goal, jobId, appId, paths, commands }, ['sandbox_pr_executor_request']);
    const pathGate = evaluatePathGate(paths);
    const commandGate = evaluateCommandGate(commands);
    const secretGate = evaluateSecretBoundary(JSON.stringify({ goal, files }));
    const benefit = userBenefitGate({
      userBenefit: 'User gets a real branch and PR proposal only after seeing gated paths, commands, and truth boundary.',
      easier: true,
      tangibleOutput: dryRun ? 'dry-run PR execution plan' : 'GitHub branch and pull request',
      nextAction: dryRun ? 'Review plan and call again with dryRun=false.' : 'Run CI/build checks and review PR before merge.',
    });
    const boundary = truthBoundary({ verified: verified.verified, containsSecret: !secretGate.allowed, containsProductionClaim: false, containsLicenseRisk: false });
    const gatesOk = pathGate.allowed && commandGate.allowed && secretGate.allowed && benefit.ok && boundary.ok;

    const ctx = getDevAppBuilderContext(req);
    const branchName = makeAgentBranchName(jobId);
    const auditBase = { jobId, appId, goal, branchName, paths, commands, inputHash, pathGate, commandGate, secretGate, benefit, truthBoundary: boundary, productionReadyClaim: false };

    if (!gatesOk) {
      const planHash = sha256(JSON.stringify(auditBase));
      await recordAppBuilderToolAudit({ ctx, jobId, toolName: 'dsg.app_builder.pr_executor', outcome: 'BLOCK', evidenceRefs: [planHash, inputHash], auditEvent: auditBase }).catch(() => null);
      return NextResponse.json({ ok: false, claimStatus: 'PR_EXECUTOR_BLOCKED', planHash, ...auditBase }, { status: 403 });
    }

    if (dryRun) {
      const planHash = sha256(JSON.stringify(auditBase));
      await recordAppBuilderToolAudit({ ctx, jobId, toolName: 'dsg.app_builder.pr_executor', outcome: 'DRY_RUN', evidenceRefs: [planHash, inputHash], auditEvent: auditBase }).catch(() => null);
      return NextResponse.json({ ok: true, claimStatus: 'PR_EXECUTOR_DRY_RUN_READY', planHash, ...auditBase, fileWrites: files.map((file) => ({ path: file.path, bytes: file.content.length })) });
    }

    const { baseBranch, repoFullName } = repoConfig();
    const baseRef = await github<GitHubRef>(`/git/ref/heads/${encodeURIComponent(baseBranch)}`);
    await github('/git/refs', { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseRef.object.sha }) });

    for (const file of files) {
      const sha = await tryGetContentSha(file.path, branchName);
      const body: Record<string, unknown> = {
        message: `DSG agent generated ${appId}: ${file.path}`,
        content: Buffer.from(file.content, 'utf8').toString('base64'),
        branch: branchName,
      };
      if (sha) body.sha = sha;
      const encodedPath = file.path.split('/').map(encodeURIComponent).join('/');
      await github(`/contents/${encodedPath}`, { method: 'PUT', body: JSON.stringify(body) });
    }

    const pr = await github<GitHubPullRequest>('/pulls', {
      method: 'POST',
      body: JSON.stringify({
        title: `DSG Agent generated app: ${appId}`,
        head: branchName,
        base: baseBranch,
        draft: true,
        body: [
          '## DSG gated PR executor',
          '',
          `Goal: ${goal}`,
          '',
          `App route: /generated-apps/${appId}`,
          `API route: /api/generated-apps/${appId}/items`,
          '',
          'Truth boundary: implementation evidence only. Production claim remains blocked until build/deploy/live proof passes.',
          '',
          'Required checks:',
          '- npm run dsg:typecheck',
          '- npm run build:termux or npm run build',
        ].join('\n'),
      }),
    });

    const result = { ok: true, claimStatus: 'IMPLEMENTED_UNVERIFIED', repoFullName, branchName, prNumber: pr.number, prUrl: pr.html_url, headSha: pr.head.sha, ...auditBase };
    const resultHash = sha256(JSON.stringify(result));
    await recordAppBuilderToolAudit({ ctx, jobId, toolName: 'dsg.app_builder.pr_executor', outcome: 'PR_CREATED', evidenceRefs: [resultHash, pr.html_url], auditEvent: result }).catch(() => null);

    return NextResponse.json({ ...result, resultHash });
  } catch (error) {
    return fail(error, error instanceof Error && error.message.includes('GITHUB_TOKEN_REQUIRED') ? 403 : 400);
  }
}
