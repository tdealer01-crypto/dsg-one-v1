#!/usr/bin/env node
// Local browser E2E for the DSG ONE UI (shell/navigation, /dsg/history, /product-ready) and for the
// auth + workspace boundary of the real API handlers it calls.
//
// NOT a production smoke. It starts its own throw-away fake Supabase (fake users, fake rows, fake
// keys - nothing real) and the built app on 127.0.0.1, then drives Chromium. It never contacts
// production and never reads real secrets.
//
// Requirements: `node scripts/dsg-next-build.mjs` already run; `playwright-core` resolvable (or set
// PLAYWRIGHT_CORE to its path); a Chromium binary (CHROME=/path/to/chrome).
// Optional: SHOT=/dir to save screenshots, E2E_APP_PORT / E2E_FAKE_PORT to change ports.
//
// `--serve` starts the same fake backend + built app and keeps them running (no browser, no checks) so a
// person can open the real UI on a real Android phone; see the printed instructions. Loopback only, fake data.
// Login-flow scenario (B9): the script gives the app process a fake
// NEXT_PUBLIC_DSG_ONE_V1_SUPABASE_PUBLISHABLE_KEY. Verified: /api/auth/session reads it at run time, so a
// normal build works. If an app build ever stops seeing it, B9 is reported as SKIPPED (never as a pass).
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const SERVE = process.argv.includes('--serve');
// Serve mode needs no browser driver, so playwright-core is only loaded for the test run.
const { chromium } = SERVE ? {} : await import(process.env.PLAYWRIGHT_CORE || 'playwright-core');

const APP_PORT = Number(process.env.E2E_APP_PORT || 18190);
const FAKE_PORT = Number(process.env.E2E_FAKE_PORT || 18191);
const PROVIDER_PORT = Number(process.env.E2E_PROVIDER_PORT || 18192);
const BASE = `http://127.0.0.1:${APP_PORT}`;
const SHOT = process.env.SHOT;

// ───────── fake Supabase (auth + the two tables the History/auth path reads)
const ID = {
  alice: '11111111-1111-4111-8111-111111111111',
  bob: '22222222-2222-4222-8222-222222222222',
  carol: '33333333-3333-4333-8333-333333333333',
};
const WS = { one: 'aaaaaaaa-0000-4000-8000-000000000001', two: 'bbbbbbbb-0000-4000-8000-000000000002' };
const jwtFor = (sub) => {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${enc({ alg: 'none' })}.${enc({ sub, exp: Math.floor(Date.now() / 1000) + 3600 })}.sig-${sub.slice(0, 4)}`;
};
const TOKEN = { alice: jwtFor(ID.alice), bob: jwtFor(ID.bob), carol: jwtFor(ID.carol) };
const EMAIL_BY_ID = { [ID.alice]: 'alice@example.test', [ID.bob]: 'bob@example.test', [ID.carol]: 'carol@example.test' };
const LOGIN = { email: 'alice@example.test', password: 'correct-password', token: TOKEN.alice };
const USER_BY_TOKEN = new Map(Object.entries(TOKEN).map(([name, tok]) => [tok, ID[name]]));
const MEMBERS = [
  { workspace_id: WS.one, actor_id: ID.alice, role: 'OPERATOR' },
  { workspace_id: WS.two, actor_id: ID.bob, role: 'OWNER' },
  { workspace_id: WS.one, actor_id: ID.carol, role: 'VIEWER' },
];
const STATUSES = ['deployed', 'failed', 'building', 'draft'];
const build = (prefix, owner, n) => Array.from({ length: n }, (_, i) => ({
  id: `${owner.slice(0, 4)}0000${String(i + 1).padStart(2, '0')}-0000-4000-8000-000000000000`,
  user_id: owner,
  app_name: `${prefix} App ${i + 1}`,
  status: STATUSES[i % 4],
  description: `change ${i + 1}`,
  lines_added: 10 + i,
  lines_removed: 2 + i,
  created_at: new Date(Date.now() - (i + 1) * 3600e3).toISOString(),
}));
const BUILDS = [...build('Alice', ID.alice, 12), ...build('Bob Secret', ID.bob, 3)];
const nid = (n) => `eeeeeeee-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const NOTIF_IDS = { failed: nid(1), deployed: nid(2), approval: nid(3), governance: nid(4), system: nid(5), bob: nid(6) };
const notifRow = (id, user, type, title, read, hoursAgo) => ({ id, user_id: user, type, title, message: `${title} (detail)`, read, created_at: new Date(Date.now() - hoursAgo * 3600e3).toISOString() });
const seedNotifs = () => [
  notifRow(NOTIF_IDS.failed, ID.alice, 'BUILD_FAILED', 'Alice build failed', false, 1),
  notifRow(NOTIF_IDS.deployed, ID.alice, 'BUILD_COMPLETE', 'Alice build deployed', false, 2),
  notifRow(NOTIF_IDS.approval, ID.alice, 'APPROVAL', 'Alice approval waiting', false, 3),
  notifRow(NOTIF_IDS.governance, ID.alice, 'GOVERNANCE', 'Alice governance digest', true, 30),
  notifRow(NOTIF_IDS.system, ID.alice, 'SYSTEM', 'Alice system notice', true, 50),
  notifRow(NOTIF_IDS.bob, ID.bob, 'SYSTEM', 'Bob Secret notice', false, 1),
];
let NOTIFS = seedNotifs();
const fake = { mode: 'ok' };
const DB_ERROR_MARKER = 'E2E-SECRET-MARKER';

const eq = (value) => (typeof value === 'string' && value.startsWith('eq.') ? value.slice(3) : undefined);
const fakeServer = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${FAKE_PORT}`);
  const send = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (url.pathname === '/auth/v1/user') {
    const token = (req.headers.authorization || '').replace(/^Bearer /i, '');
    const id = USER_BY_TOKEN.get(token);
    return id ? send(200, { id, email: EMAIL_BY_ID[id] }) : send(401, { message: 'invalid JWT' });
  }
  if (url.pathname === '/auth/v1/token' && req.method === 'POST') {
    let text = '';
    req.on('data', (c) => { text += c; });
    req.on('end', () => {
      let body = {};
      try { body = JSON.parse(text); } catch { /* invalid body -> rejected below */ }
      return body.email === LOGIN.email && body.password === LOGIN.password
        ? send(200, { access_token: LOGIN.token, refresh_token: 'refresh-e2e', expires_in: 3600 })
        : send(400, { error_description: 'Invalid login credentials' });
    });
    return undefined;
  }
  if (url.pathname === '/rest/v1/dsg_workspace_members') {
    const ws = eq(url.searchParams.get('workspace_id'));
    const actor = eq(url.searchParams.get('actor_id'));
    const rows = MEMBERS.filter((m) => (!ws || m.workspace_id === ws) && (!actor || m.actor_id === actor));
    const limit = Number(url.searchParams.get('limit') || rows.length);
    return send(200, rows.slice(0, limit).map((m) => ({ workspace_id: m.workspace_id, role: m.role })));
  }
  if (url.pathname === '/rest/v1/dsg_app_builds') {
    if (fake.mode === 'dberror') return send(400, { message: `relation "dsg_app_builds" does not exist (${DB_ERROR_MARKER})` });
    const status = eq(url.searchParams.get('status'));
    const since = (url.searchParams.get('created_at') || '').replace(/^gte\./, '');
    const limit = Number(url.searchParams.get('limit') || Infinity);
    const rows = BUILDS.filter((b) => b.user_id === eq(url.searchParams.get('user_id')) && (!status || b.status === status) && (!since || b.created_at >= since))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, limit);
    return send(200, rows);
  }
  if (url.pathname === '/rest/v1/dsg_notifications') {
    if (fake.mode === 'dberror') return send(400, { message: `relation "dsg_notifications" does not exist (${DB_ERROR_MARKER})` });
    const owner = eq(url.searchParams.get('user_id'));
    const id = eq(url.searchParams.get('id'));
    const read = eq(url.searchParams.get('read'));
    const typeParam = url.searchParams.get('type');
    const typeOk = (t) => !typeParam || (typeParam.startsWith('in.(') ? typeParam.slice(4, -1).split(',').includes(t) : typeParam.startsWith('eq.') ? typeParam.slice(3) === t : true);
    const rows = NOTIFS.filter((n) => (!owner || n.user_id === owner) && (!id || n.id === id) && (read === undefined || String(n.read) === read) && typeOk(n.type))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    if (req.method === 'PATCH') {
      req.on('data', () => {});
      req.on('end', () => { for (const n of rows) n.read = true; send(200, rows.map((n) => ({ id: n.id, read: n.read }))); });
      return undefined;
    }
    return send(200, rows);
  }
  return send(404, { message: 'not found in fake supabase' });
});
await new Promise((resolve) => fakeServer.listen(FAKE_PORT, '127.0.0.1', resolve));

// ───────── fake third-party providers (OpenAI-compatible, Katzilla, ActiveCampaign) that record every call
// Used to prove who can make the SERVER spend its own provider credentials. Nothing here is real.
const providerLog = [];
const providerServer = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PROVIDER_PORT}`);
  providerLog.push({ method: req.method, path: url.pathname + url.search, authorization: req.headers.authorization, apiKey: req.headers['x-api-key'], acToken: req.headers['api-token'] });
  const send = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  req.resume();
  if (url.pathname.startsWith('/openai/')) return send(200, { id: 'resp_fake', output_text: 'fake', output: [{ type: 'message', content: [{ type: 'output_text', text: 'fake' }] }], choices: [{ message: { content: 'fake' } }] });
  if (url.pathname.startsWith('/agents') || url.pathname.startsWith('/v1/')) return send(200, { agents: [] });
  if (url.pathname === '/ac/api/3/contacts') return send(200, { contacts: [{ id: '7', email: (url.searchParams.get('email') || '').toLowerCase() }] });
  if (url.pathname === '/ac/api/3/contacts/7/contactTags') return send(200, { contactTags: [] });
  if (url.pathname === '/ac/api/3/contactTags') return send(201, {});
  return send(404, {});
});
await new Promise((resolve) => providerServer.listen(PROVIDER_PORT, '127.0.0.1', resolve));
const PROVIDER_KEYS = { openai: 'local-e2e-fake-openai-key', katzilla: 'local-e2e-fake-katzilla-key', ac: 'local-e2e-fake-ac-token' };

// ───────── the built app, pointed at the fake
const env = { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' };
// Never let a real credential from the caller's shell reach the app under test.
for (const name of Object.keys(env)) if (/(API_KEY|_TOKEN|SECRET|SERVICE_ROLE|PASSWORD)/i.test(name)) delete env[name];
for (const name of ['DSG_ONE_V1_SUPABASE_URL', 'NEXT_PUBLIC_DSG_ONE_V1_SUPABASE_URL', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL',
  'DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_DSG_ONE_V1_SUPABASE_PUBLISHABLE_KEY', 'DSG_ALLOW_DEV_HEADER_ACTOR', 'DSG_ALLOW_DEV_AUTH_HEADERS']) delete env[name];
env.DSG_ONE_V1_SUPABASE_URL = `http://127.0.0.1:${FAKE_PORT}`;
env.DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY = 'local-e2e-fake-key-not-a-secret';
env.NEXT_PUBLIC_DSG_ONE_V1_SUPABASE_PUBLISHABLE_KEY = 'local-e2e-fake-publishable-key';
env.OPENAI_API_KEY = PROVIDER_KEYS.openai;
env.OPENAI_API_BASE = `http://127.0.0.1:${PROVIDER_PORT}/openai/v1`;
env.KATZILLA_API_KEY = PROVIDER_KEYS.katzilla;
env.KATZILLA_API_BASE = `http://127.0.0.1:${PROVIDER_PORT}`; // the connector resolves '/agents' against the origin
env.ACTIVECAMPAIGN_API_URL = `http://127.0.0.1:${PROVIDER_PORT}/ac`;
env.ACTIVECAMPAIGN_API_TOKEN = PROVIDER_KEYS.ac;
env.ACTIVECAMPAIGN_TAG_PROOF_VIEWED_ID = '11';
env.ACTIVECAMPAIGN_TAG_VERIFICATION_STARTED_ID = '12';
env.ACTIVECAMPAIGN_TAG_PROOF_CREATED_ID = '13';
const nextBin = path.join(process.cwd(), 'node_modules', '.bin', 'next');
const app = spawn(nextBin, ['start', '-p', String(APP_PORT), '-H', '127.0.0.1'], { env, stdio: 'ignore' });
const shutdown = () => { app.kill('SIGTERM'); fakeServer.close(); providerServer.close(); };
process.on('exit', () => app.kill('SIGTERM'));
{
  const end = Date.now() + 40000;
  let up = false;
  while (Date.now() < end && !up) {
    up = await fetch(`${BASE}/product-ready`).then((r) => r.ok).catch(() => false);
    if (!up) await new Promise((r) => setTimeout(r, 300));
  }
  if (!up) { console.log('BLOCKED  the built app did not start (run `node scripts/dsg-next-build.mjs` first)'); shutdown(); process.exit(2); }
}
if (SERVE) {
  console.log(`SERVE  DSG ONE UI on FAKE data (fake users and rows, nothing real). Loopback only: http://localhost:${APP_PORT}
  Real Android phone (USB debugging on):
    1. adb reverse tcp:${APP_PORT} tcp:${APP_PORT}
    2. open  http://localhost:${APP_PORT}/login  in Chrome on the phone  (localhost is needed: the session cookies are Secure)
    3. sign in as alice@example.test / correct-password  (fake)  -> Workspace, Workroom, Approvals, Verify, History, Analytics, Notifications
  Stop with Ctrl+C.
  This only gives you something to test. Android hardware acceptance stays NOT VERIFIED until someone does it on a device.`);
  process.on('SIGINT', () => { shutdown(); process.exit(0); });
  process.on('SIGTERM', () => { shutdown(); process.exit(0); });
  await new Promise(() => {});
}
const shot = async (page, name, fullPage = false) => { if (SHOT) await page.screenshot({ path: `${SHOT}/${name}`, fullPage }); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const fakeJwt = `${b64({ alg: 'none' })}.${b64({ exp: Math.floor(Date.now() / 1000) + 3600 })}.x`;

const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok: !!ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); };

const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString();
const HOUR = 3600e3;
const items = (n, offset = 0) => Array.from({ length: n }, (_, i) => ({
  id: `0000000${i + offset}-aaaa-bbbb-cccc-dddddddddddd`,
  appName: `แอปทดสอบ ${i + offset + 1}`,
  status: ['DEPLOYED', 'FAILED', 'BUILDING', 'DRAFT'][(i + offset) % 4],
  timestamp: iso((i + 1) * 2 * HOUR),
  summary: `สรุปการเปลี่ยนแปลงข้อที่ ${i + offset + 1}`,
  addedLines: 10 + i, removedLines: 2 + i,
}));
const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox', '--disable-background-networking', '--disable-sync', '--no-first-run'] });

async function newPage(vp) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, hasTouch: vp.width < 600, isMobile: vp.width < 600 });
  await ctx.addCookies([{ name: 'sb-access-token', value: fakeJwt, url: BASE }]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('response', (r) => { if (r.status() >= 400 && !/\/api\/dsg\/history|\/favicon\.ico/.test(r.url())) errors.push('HTTP ' + r.status() + ' ' + r.url()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text() + (m.location().url || ''))) errors.push('console: ' + m.text()); });
  return { page, errors, ctx };
}
const until = async (fn, ms = 4000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 50)); } return false; };
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

// ───────── Android phone 360x800
{
  const { page, errors, ctx } = await newPage({ width: 360, height: 800 });
  const calls = [];
  await page.route('**/api/dsg/history*', (route) => {
    const u = new URL(route.request().url());
    calls.push(u.search);
    const page_ = Number(u.searchParams.get('page') || '1');
    return json(route, 200, { ok: true, data: { items: items(10, (page_ - 1) * 10), total: 14, page: page_, totalPages: 2 } });
  });
  await page.goto(`${BASE}/dsg/history`, { waitUntil: 'networkidle' });

  const tabs = page.locator('nav[aria-label="DSG ONE shortcuts"]');
  check('[360] bottom tab bar visible', await tabs.isVisible());
  const tabBoxes = await tabs.locator('a,button').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { t: (e.textContent || '').trim(), w: Math.round(r.width), h: Math.round(r.height) }; }));
  check('[360] 5 tab targets (4 links + เมนู)', tabBoxes.length === 5, JSON.stringify(tabBoxes.map((b) => b.t)));
  check('[360] every tab target >= 44px tall and >= 44px wide', tabBoxes.every((b) => b.h >= 44 && b.w >= 44), JSON.stringify(tabBoxes.map((b) => `${b.w}x${b.h}`)));
  check('[360] tab bar includes Approvals and Verify', tabBoxes.some((b) => b.t === 'Approvals') && tabBoxes.some((b) => b.t === 'Verify'));
  const tabBottom = await tabs.evaluate((e) => Math.round(e.getBoundingClientRect().bottom));
  check('[360] tab bar sits at the bottom of the viewport (not cut off)', Math.abs(tabBottom - 800) <= 1, `bottom=${tabBottom}`);
  check('[360] no horizontal overflow on /dsg/history', !(await overflow(page)));

  // full menu
  await tabs.getByRole('button', { name: 'Menu' }).click();
  const dialog = page.getByRole('dialog', { name: 'DSG ONE menu' });
  check('[360] Menu tab opens the drawer dialog', await dialog.isVisible());
  const labels = await dialog.locator('a').allTextContents();
  const need = ['Workspace', 'Workroom', 'Approvals', 'Verify', 'App Builder', 'History'];
  check('[360] menu lists the core surfaces', need.every((n) => labels.some((l) => l.trim() === n)), `missing=${need.filter((n) => !labels.some((l) => l.trim() === n))}`);
  check('[360] menu has NO dead "Settings" entry', !labels.some((l) => /settings/i.test(l)));
  const menuSmall = await dialog.locator('a,button').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 44).map((e) => (e.textContent || '').trim()));
  check('[360] every menu link/button >= 44px tall', menuSmall.length === 0, JSON.stringify(menuSmall));
  const asideBg = await dialog.locator('aside').evaluate((e) => getComputedStyle(e).backgroundColor);
  check('[360] menu panel is opaque (tab bar does not show through)', /^rgb\(/.test(asideBg), asideBg);
  const lastLink = dialog.getByRole('link', { name: 'Autonomous Level' });
  await lastLink.scrollIntoViewIfNeeded();
  const lb = await lastLink.boundingBox();
  check('[360] last section (Insights > Autonomous Level) is reachable by scrolling and fully visible', lb && lb.y >= 0 && lb.y + lb.height <= 800, JSON.stringify(lb));
  const backLink = dialog.getByRole('link', { name: 'Home' });
  await backLink.scrollIntoViewIfNeeded();
  const bb = await backLink.boundingBox();
  check('[360] "Home" reachable at the end of the same scroll list', bb && bb.y + bb.height <= 800, JSON.stringify(bb));
  await shot(page, 'dsg-menu-360.png');
  await page.keyboard.press('Escape');
  check('[360] Escape closes the menu', !(await dialog.isVisible().catch(() => false)));

  // history content from the (stubbed) API
  const articles = await page.locator('article').count();
  check('[360] 10 history cards rendered from API', articles === 10, `n=${articles}`);
  const firstTime = (await page.locator('time').first().textContent())?.trim();
  check('[360] relative time is computed (Thai, not a hard-coded "2 hours ago")', !!firstTime && /ชั่วโมง|นาที|เมื่อ/.test(firstTime) && !/hours? ago/i.test(firstTime), `"${firstTime}"`);
  const disabled = await page.locator('article button[disabled]').count();
  check('[360] ดู/กู้คืน are disabled on every card (20 buttons)', disabled === 20, `n=${disabled}`);
  const btnSmall = await page.locator('article button, select, input[type=search]').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 44).length);
  check('[360] cards buttons / filters >= 44px tall', btnSmall === 0, `short=${btnSmall}`);
  const badges = await page.locator('article [data-tone]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-tone')}:${(e.textContent || '').trim()}`));
  check('[360] badges carry tone + Thai text', badges.length === 10 && badges.every((x) => /:(ใช้งานแล้ว|ล้มเหลว|กำลังสร้าง|ฉบับร่าง)$/.test(x)), badges.slice(0, 4).join(' | '));
  const pendingBorder = await page.locator('article [data-tone="pending"]').first().evaluate((e) => getComputedStyle(e).borderTopColor);
  check('[360] pending badge is not the gold used for review/active (distinct colour)', !/247, 201, 72/.test(pendingBorder), pendingBorder);
  await shot(page, 'dsg-history-360.png');

  // compare
  await page.locator('article').nth(0).getByRole('button', { name: 'เปรียบเทียบ' }).click();
  await page.locator('article').nth(1).getByRole('button', { name: 'เปรียบเทียบ' }).click();
  check('[360] compare shows both versions', (await page.getByText('โหมดเปรียบเทียบ').isVisible()) && (await page.locator('text=เทียบกับ').count()) === 1);

  // filters hit the API with the right params
  await page.locator('select').selectOption('FAILED');
  const sentFailed = await until(() => calls.some((c) => c.includes('status=FAILED') && c.includes('page=1')));
  check('[360] status filter sends status=FAILED&page=1', sentFailed, calls.at(-1));
  await page.locator('input[type=search]').fill('บัญชี');
  await page.waitForTimeout(700);
  const lastCall = calls.at(-1) || '';
  check('[360] search is debounced and sent as search=', lastCall.includes('search=') && decodeURIComponent(lastCall).includes('บัญชี'), decodeURIComponent(lastCall));
  const burst = calls.length;
  check('[360] typing one word did not fire a request per keystroke', calls.filter((c) => c.includes('search=')).length === 1, `search-calls=${calls.filter((c) => c.includes('search=')).length} total=${burst}`);

  // pagination
  await page.locator('select').selectOption('ALL');
  await page.locator('input[type=search]').fill('');
  await until(() => (calls.at(-1) || '').includes('status=ALL') && !(calls.at(-1) || '').includes('search='));
  await page.getByRole('button', { name: /ถัดไป/ }).waitFor();
  await page.getByRole('button', { name: /ถัดไป/ }).click();
  check('[360] pagination requests page=2', await until(() => calls.some((c) => c.includes('page=2'))));
  check('[360] page indicator shows 2 / 2', await until(() => page.getByText('หน้า 2 / 2').isVisible()));

  check('[360] no page/console errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ───────── History states (phone)
async function stateCase(label, handler, assertFn) {
  const { page, errors, ctx } = await newPage({ width: 360, height: 800 });
  let n = 0;
  await page.route('**/api/dsg/history*', (route) => handler(route, ++n));
  await page.goto(`${BASE}/dsg/history`, { waitUntil: 'networkidle' });
  await assertFn(page, () => n);
  check(`[state:${label}] no overflow`, !(await overflow(page)));
  check(`[state:${label}] no page/console errors`, errors.filter((e) => !/status of (4|5)\d\d|Failed to load resource|net::ERR/.test(e)).length === 0, errors.join(' | '));
  await shot(page, 'dsg-history-${label}.png');
  await ctx.close();
}

await stateCase('empty', (r) => json(r, 200, { ok: true, data: { items: [], total: 0, page: 1, totalPages: 1 } }), async (p) => {
  check('[state:empty] honest empty message + link to App Builder', (await p.getByText('ยังไม่มีประวัติการสร้างแอป').isVisible()) && (await p.getByRole('link', { name: 'เปิด App Builder' }).isVisible()));
  check('[state:empty] shows no invented cards', (await p.locator('article').count()) === 0);
});
await stateCase('auth403', (r) => json(r, 403, { ok: false, error: { code: 'DSG_AUTH_REQUIRED' } }), async (p) => {
  check('[state:403] tells the user to sign in, with a login link', (await p.getByText(/ต้องเข้าสู่ระบบก่อนดูประวัติ \(HTTP 403\)/).isVisible()) && ((await p.getByRole('link', { name: 'เข้าสู่ระบบ' }).getAttribute('href')) === '/login?next=/dsg/history'));
  check('[state:403] raw error code is not shown', (await p.getByText('DSG_AUTH_REQUIRED').count()) === 0);
});
await stateCase('server500', (r, n) => n === 1 ? json(r, 500, { ok: false, error: { code: 'invalid input syntax for type uuid: "demo-workspace"' } }) : json(r, 200, { ok: true, data: { items: items(2), total: 2, page: 1, totalPages: 1 } }), async (p, calls) => {
  check('[state:500] actionable message with HTTP code', await p.getByText(/โหลดประวัติไม่สำเร็จ \(HTTP 500\)/).isVisible());
  check('[state:500] raw database error text is NOT shown to the user', (await p.getByText(/invalid input syntax|uuid|demo-workspace/).count()) === 0);
  await p.getByRole('button', { name: 'ลองใหม่' }).click();
  const recovered = await until(async () => calls() === 2 && (await p.locator('article').count()) === 2);
  check('[state:500] retry re-requests and then shows the data', recovered, `requests=${calls()}`);
});
await stateCase('network', (r) => r.abort('failed'), async (p) => {
  check('[state:network] says the server is unreachable + retry button', (await p.getByText('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้').isVisible()) && (await p.getByRole('button', { name: 'ลองใหม่' }).isVisible()));
});

// ───────── Desktop 1280
{
  const { page, errors, ctx } = await newPage({ width: 1280, height: 900 });
  await page.route('**/api/dsg/history*', (r) => json(r, 200, { ok: true, data: { items: items(3), total: 3, page: 1, totalPages: 1 } }));
  await page.goto(`${BASE}/dsg/history`, { waitUntil: 'networkidle' });
  check('[1280] sidebar visible', await page.locator('aside').first().isVisible());
  check('[1280] bottom tab bar hidden on desktop', !(await page.locator('nav[aria-label="DSG ONE shortcuts"]').isVisible()));
  const active = await page.locator('aside a[aria-current="page"]').allTextContents();
  check('[1280] current page marked aria-current in the sidebar', active.length === 1 && active[0].trim() === 'History', JSON.stringify(active));
  const side = await page.locator('aside nav a').allTextContents();
  check('[1280] sidebar lists Approvals and Verify', side.some((t) => t.trim() === 'Approvals') && side.some((t) => t.trim() === 'Verify'));
  check('[1280] no horizontal overflow', !(await overflow(page)));
  check('[1280] no page/console errors', errors.length === 0, errors.join(' | '));
  await shot(page, 'dsg-history-1280.png');
  await ctx.close();
}

// ───────── real (native) navigation from the shortcut bar and the drawer, phone
{
  const { page, ctx } = await newPage({ width: 360, height: 800 });
  await page.route('**/api/**', (r) => json(r, 401, { ok: false }));
  await page.goto(`${BASE}/dsg/history`, { waitUntil: 'domcontentloaded' });
  await page.locator('nav[aria-label="DSG ONE shortcuts"]').getByRole('link', { name: 'Approvals' }).click();
  check('[nav] tapping the Approvals shortcut really navigates to /dsg/approvals', await until(() => /\/dsg\/approvals/.test(page.url())), page.url());
  await page.goto(`${BASE}/dsg/history`, { waitUntil: 'domcontentloaded' });
  await page.locator('nav[aria-label="DSG ONE shortcuts"]').getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('dialog', { name: 'DSG ONE menu' }).getByRole('link', { name: 'Verify' }).click();
  check('[nav] tapping Verify in the drawer really navigates to /dsg/verify', await until(() => /\/dsg\/verify/.test(page.url())), page.url());
  await ctx.close();
}

// ───────── Android "desktop site": wide CSS viewport but a coarse touch pointer
{
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await ctx.addCookies([{ name: 'sb-access-token', value: fakeJwt, url: BASE }]);
  const page = await ctx.newPage();
  await page.route('**/api/dsg/history*', (r) => json(r, 200, { ok: true, data: { items: items(2), total: 2, page: 1, totalPages: 1 } }));
  await page.goto(`${BASE}/dsg/history`, { waitUntil: 'networkidle' });
  const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  const sidebarVisible = await page.locator('.dsg-sidebar-desktop').isVisible();
  const tabsVisible = await page.locator('nav[aria-label="DSG ONE shortcuts"]').isVisible();
  const burger = await page.locator('.dsg-sidebar-mobile-header').isVisible();
  console.log('   desktop-site emulation: pointer coarse =', coarse, '| desktop sidebar =', sidebarVisible, '| shortcut bar =', tabsVisible, '| header hamburger =', burger);
  check('[desktop-site] coarse pointer detected in this emulation', coarse);
  check('[desktop-site] tiny desktop sidebar is replaced by the drawer + shortcut bar', !sidebarVisible && tabsVisible && burger);
  await shot(page, 'dsg-desktop-site-1100.png');
  await ctx.close();
}

// ───────── /product-ready badges (public, server-rendered)
{
  const { page, errors, ctx } = await newPage({ width: 360, height: 800 });
  await page.goto(`${BASE}/product-ready`, { waitUntil: 'networkidle' });
  const tones = await page.locator('[data-tone]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-tone')}:${(e.textContent || '').trim()}`));
  check('[product-ready] checks render shared StatusBadge (icon+word)', tones.length > 0 && tones.every((t) => /^(pass|fail|blocked|pending|review|neutral):/.test(t)), tones.slice(0, 4).join(' | '));
  check('[product-ready] every badge has an SVG icon (not colour-only)', await page.locator('[data-tone] svg').count() === tones.length);
  check('[product-ready] no horizontal overflow at 360', !(await overflow(page)));
  check('[product-ready] no page/console errors', errors.length === 0, errors.join(' | '));
  await shot(page, 'product-ready-360.png', true);
  console.log('   product-ready tones:', tones.join(' | '));
  await ctx.close();
}


// ═════════ Part B: REAL route handlers behind the real pages (fake database, no page.route stubs)
console.log('\n── Part B: real handlers + fake Supabase');
const raw = (method, pathname, headers = {}, body) => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port: APP_PORT, path: pathname, method, headers }, (res) => {
    let text = '';
    res.on('data', (c) => { text += c; });
    res.on('end', () => resolve({ status: res.statusCode, text, headers: res.headers }));
  });
  req.on('error', reject);
  if (body) req.write(body);
  req.end();
});
const bearer = (tok) => ({ authorization: `Bearer ${tok}` });
const codeOf = (r) => { try { return JSON.parse(r.text)?.error?.code; } catch { return undefined; } };

async function sessionPage({ token, workspace, viewport = { width: 390, height: 844 } }) {
  const ctx = await browser.newContext({ viewport });
  const cookies = [];
  if (token) cookies.push({ name: 'sb-access-token', value: token, url: BASE });
  if (workspace) cookies.push({ name: 'dsg-workspace-id', value: workspace, url: BASE });
  if (cookies.length) await ctx.addCookies(cookies);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { ctx, page, errors };
}
const cardNames = (page) => page.locator('article p.font-bold').allTextContents();

// B1 / B2: data on the page comes from the handler's database, scoped to the signed-in user
{
  const { ctx, page, errors } = await sessionPage({ token: TOKEN.alice, workspace: WS.one });
  await page.goto(`${BASE}/dsg/history`, { waitUntil: 'networkidle' });
  await page.waitForSelector('article');
  const first = await cardNames(page);
  check('[B1] alice sees 10 of her 12 builds from the real API (page 1)', first.length === 10 && first.every((n) => n.startsWith('Alice App ')), first.join(', '));
  check('[B1] header total comes from the database count (12)', await page.getByText('12 รายการ').isVisible());
  check('[B1] bob\'s builds never appear for alice', !(await page.content()).includes('Bob Secret'));
  await page.getByRole('button', { name: /ถัดไป/ }).click();
  await until(async () => (await cardNames(page)).includes('Alice App 11'));
  check('[B1] page 2 shows the remaining two builds', JSON.stringify(await cardNames(page)) === JSON.stringify(['Alice App 11', 'Alice App 12']), (await cardNames(page)).join(', '));
  await page.getByRole('button', { name: /ก่อนหน้า/ }).click();
  await page.locator('select').selectOption('FAILED');
  await until(async () => (await cardNames(page)).length === 3);
  const failed = await page.locator('article [data-tone]').allTextContents();
  check('[B1] status filter FAILED returns only failed builds (server-side)', (await cardNames(page)).length === 3 && failed.every((t) => t.includes('ล้มเหลว')), failed.join('|'));
  await page.locator('select').selectOption('ALL');
  await page.locator('input[type=search]').fill('app 12');
  await until(async () => (await cardNames(page)).length === 1);
  check('[B1] search narrows to the matching build', JSON.stringify(await cardNames(page)) === JSON.stringify(['Alice App 12']), (await cardNames(page)).join(', '));
  await shot(page, 'real-history-alice-390.png');
  check('[B1] no uncaught page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
{
  const { ctx, page } = await sessionPage({ token: TOKEN.bob, workspace: WS.two });
  await page.goto(`${BASE}/dsg/history`, { waitUntil: 'networkidle' });
  await page.waitForSelector('article');
  const names = await cardNames(page);
  check('[B2] bob sees only his 3 builds and none of alice\'s', names.length === 3 && names.every((n) => n.startsWith('Bob Secret App ')) && !(await page.content()).includes('Alice App'), names.join(', '));
  await ctx.close();
}

// B3: the page itself is behind the login redirect
{
  const { ctx, page } = await sessionPage({});
  await page.goto(`${BASE}/dsg/history`, { waitUntil: 'domcontentloaded' });
  check('[B3] no session -> redirected to /login?next=/dsg/history', /\/login\?next=%2Fdsg%2Fhistory/.test(page.url()), page.url());
  await ctx.close();
}

// B4: workspace binding / identity on the real API handler
{
  const none = await raw('GET', '/api/dsg/history');
  check('[B4] no credentials -> 403 DSG_AUTH_REQUIRED', none.status === 403 && codeOf(none) === 'DSG_AUTH_REQUIRED', `${none.status} ${codeOf(none)}`);
  const spoof = await raw('GET', '/api/dsg/history', { 'x-dsg-actor-id': ID.alice, 'x-dsg-actor-role': 'OWNER', 'x-dsg-workspace-id': WS.one });
  check('[B4] spoofed actor/role/workspace headers without a token are ignored -> 403', spoof.status === 403 && !spoof.text.includes('Alice App'), `${spoof.status}`);
  const notMember = await raw('GET', '/api/dsg/history', { ...bearer(TOKEN.alice), 'x-dsg-workspace-id': WS.two });
  check('[B4] valid token + a workspace the user is NOT a member of -> 403', notMember.status === 403 && !notMember.text.includes('Alice App'), `${notMember.status} ${codeOf(notMember)}`);
  const badToken = await raw('GET', '/api/dsg/history', { ...bearer('not-a-real-token'), 'x-dsg-workspace-id': WS.one });
  check('[B4] unknown/forged token -> 403 (verified against the auth server, not just JWT shape)', badToken.status === 403, `${badToken.status}`);
  const forged = await raw('GET', '/api/dsg/history', { ...bearer(jwtFor(ID.alice) + 'x'), 'x-dsg-workspace-id': WS.one });
  check('[B4] a structurally valid but unregistered JWT -> 403', forged.status === 403, `${forged.status}`);
  const mine = await raw('GET', '/api/dsg/history', { ...bearer(TOKEN.alice), 'x-dsg-workspace-id': WS.one, 'x-dsg-actor-id': ID.bob });
  const mineBody = JSON.parse(mine.text);
  check('[B4] identity comes from the token: a spoofed x-dsg-actor-id (bob) still returns alice\'s rows only', mine.status === 200 && mineBody.data.items.every((i) => i.appName.startsWith('Alice App ')) && !mine.text.includes('Bob Secret'), `${mine.status}`);
  const viaCookie = await raw('GET', '/api/dsg/history', { cookie: `sb-access-token=${TOKEN.alice}; dsg-workspace-id=${WS.one}` });
  check('[B4] cookie session + workspace cookie works the same as headers', viaCookie.status === 200, `${viaCookie.status}`);
  const cookieNoWs = await raw('GET', '/api/dsg/history', { cookie: `sb-access-token=${TOKEN.alice}` });
  check('[B4] a session without a selected workspace is refused (no implicit workspace)', cookieNoWs.status === 403, `${cookieNoWs.status}`);
}

// B5: a database failure never reaches the browser as raw text
{
  fake.mode = 'dberror';
  const api = await raw('GET', '/api/dsg/history', { ...bearer(TOKEN.alice), 'x-dsg-workspace-id': WS.one });
  check('[B5] DB error -> 500 with a generic code, no table/driver text in the JSON', api.status === 500 && codeOf(api) === 'HISTORY_FETCH_FAILED' && !api.text.includes(DB_ERROR_MARKER) && !api.text.includes('dsg_app_builds'), `${api.status} ${api.text.slice(0, 80)}`);
  const { ctx, page } = await sessionPage({ token: TOKEN.alice, workspace: WS.one });
  await page.goto(`${BASE}/dsg/history`, { waitUntil: 'networkidle' });
  await page.getByText(/โหลดประวัติไม่สำเร็จ \(HTTP 500\)/).waitFor();
  const html = await page.content();
  check('[B5] UI says it failed (HTTP 500) with a retry button and shows no DB text', (await page.getByRole('button', { name: 'ลองใหม่' }).isVisible()) && !html.includes(DB_ERROR_MARKER) && !html.includes('dsg_app_builds'));
  fake.mode = 'ok';
  await page.getByRole('button', { name: 'ลองใหม่' }).click();
  check('[B5] retry after the database recovers shows the real rows again', await until(async () => (await cardNames(page)).length === 10));
  await ctx.close();
}

// B6: /api/dsg/tools (fixed on main) - verify the behaviour, do not re-fix
{
  const body = JSON.stringify({ tool: 'plan', action: 'create', goal: 'x' });
  const json = { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(body)) };
  const anon = await raw('POST', '/api/dsg/tools', json, body);
  check('[B6] /api/dsg/tools without a verified user -> 401', anon.status === 401, `${anon.status} ${codeOf(anon)}`);
  const viewer = await raw('POST', '/api/dsg/tools', { ...json, ...bearer(TOKEN.carol), 'x-dsg-workspace-id': WS.one }, body);
  check('[B6] a VIEWER (no job:plan) -> 403', viewer.status === 403, `${viewer.status}`);
  const badOrigin = await raw('POST', '/api/dsg/tools', { ...json, ...bearer(TOKEN.alice), 'x-dsg-workspace-id': WS.one, origin: 'https://evil.example' }, body);
  check('[B6] foreign Origin -> 403 DSG_ORIGIN_DENIED before anything runs', badOrigin.status === 403 && codeOf(badOrigin) === 'DSG_ORIGIN_DENIED', `${badOrigin.status} ${codeOf(badOrigin)}`);
  const exec = JSON.stringify({ tool: 'shell', action: 'exec', goal: 'x', execute: true });
  const execRes = await raw('POST', '/api/dsg/tools', { ...bearer(TOKEN.alice), 'x-dsg-workspace-id': WS.one, 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(exec)) }, exec);
  check('[B6] execute:true over HTTP is refused even for an OPERATOR', execRes.status === 403 && codeOf(execRes) === 'DSG_SIGNED_EXECUTION_AUTHORITY_REQUIRED', `${execRes.status} ${codeOf(execRes)}`);
}

// B7: every menu / shortcut destination resolves with a real session (no 404, no crash)
{
  const layout = readFileSync(path.join(process.cwd(), 'app/dsg/layout.tsx'), 'utf8');
  const hrefs = [...new Set([...layout.matchAll(/href:\s*'(\/dsg\/[^']+)'/g)].map((m) => m[1]))];
  const { ctx, page, errors } = await sessionPage({ token: TOKEN.alice, workspace: WS.one });
  const bad = [];
  const notes = [];
  for (const href of hrefs) {
    errors.length = 0;
    const res = await page.goto(`${BASE}${href}`, { waitUntil: 'load' });
    await page.waitForTimeout(400);
    const status = res?.status() ?? 0;
    const finalPath = new URL(page.url()).pathname;
    const crashed = (await page.getByText(/Application error|client-side exception/i).count()) > 0;
    if (status >= 400 || crashed || errors.length) bad.push(`${href}: status=${status} crashed=${crashed} errors=${errors.join('|').slice(0, 80)}`);
    notes.push(`${href}${finalPath !== href ? ` -> ${finalPath}` : ''}`);
  }
  check(`[B7] all ${hrefs.length} menu destinations load without 4xx/5xx, crash or uncaught error`, bad.length === 0, bad.join(' ; '));
  console.log('   destinations:', notes.join(' | '));
  await ctx.close();
}

// B8: the sidebar navigates natively (full document load), as #212 requires
{
  const { ctx, page } = await sessionPage({ token: TOKEN.alice, workspace: WS.one, viewport: { width: 1280, height: 900 } });
  await page.goto(`${BASE}/dsg/history`, { waitUntil: 'networkidle' });
  await page.evaluate(() => { window.__spaMarker = 'still-the-same-document'; });
  const links = await page.locator('aside nav a').evaluateAll((els) => els.map((e) => ({ tag: e.tagName, href: e.getAttribute('href') })));
  check('[B8] sidebar items are native <a href> elements (#212)', links.length >= 14 && links.every((l) => l.tag === 'A' && l.href), `n=${links.length}`);
  await page.locator('aside nav').getByRole('link', { name: 'Verify' }).click();
  await page.waitForURL(/\/dsg\/verify/);
  const marker = await page.evaluate(() => window.__spaMarker);
  check('[B8] clicking Verify is a real navigation (document reloaded, not a client-side transition)', marker === undefined, String(marker));
  await ctx.close();
}

// B9: the whole chain: login -> HttpOnly/Secure cookie -> workspace selection (membership checked) -> real data
{
  const post = (pathname, payload, cookie) => raw('POST', pathname, { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, JSON.stringify(payload));
  const probe = await post('/api/auth/session', { email: LOGIN.email, password: LOGIN.password });
  if (probe.status === 500 && /DSG_AUTH_CONFIG_REQUIRED/.test(probe.text)) {
    console.log('SKIPPED  [B9] login flow: the app has no NEXT_PUBLIC_DSG_ONE_V1_SUPABASE_PUBLISHABLE_KEY (the app process could not read it; see the header of this script). NOT counted as a pass.');
  } else {
    const wrong = await post('/api/auth/session', { email: LOGIN.email, password: 'wrong' });
    check('[B9] wrong password -> 401 and no session cookie is issued', wrong.status === 401 && !(wrong.headers['set-cookie'] || []).some((c) => c.startsWith('sb-access-token=')), `${wrong.status}`);
    const cookies = probe.headers['set-cookie'] || [];
    const access = cookies.find((c) => c.startsWith('sb-access-token=')) || '';
    check('[B9] login issues the session cookie as HttpOnly + Secure + SameSite=Lax', probe.status === 200 && /HttpOnly/i.test(access) && /Secure/i.test(access) && /SameSite=lax/i.test(access), access.replace(/=[^;]+/, '=<token>'));

    const { ctx, page } = await sessionPage({});
    await page.goto(`${BASE}/login?next=/dsg/access`, { waitUntil: 'networkidle' });
    await page.locator('input[type=email]').fill(LOGIN.email);
    await page.locator('input[type=password]').fill(LOGIN.password);
    await page.locator('button[type=submit]').click();
    await page.waitForURL(/\/dsg\/access/, { timeout: 15000 });
    await page.getByText('Active session workspace').waitFor({ timeout: 15000 });
    check('[B9] UI sign-in lands on /dsg/access and the single membership is activated (server-verified)', true);
    const jar = await ctx.cookies();
    const byName = Object.fromEntries(jar.map((c) => [c.name, c]));
    check('[B9] browser holds the session + workspace cookies, both HttpOnly and not readable by page scripts', !!byName['sb-access-token']?.httpOnly && !!byName['dsg-workspace-id']?.httpOnly && byName['dsg-workspace-id']?.value === WS.one && !(await page.evaluate(() => document.cookie)).includes('sb-access-token'));
    await page.goto(`${BASE}/dsg/history`, { waitUntil: 'networkidle' });
    await page.waitForSelector('article');
    const names = await cardNames(page);
    check('[B9] after the real login, History shows alice\'s real rows', names.length === 10 && names.every((n) => n.startsWith('Alice App ')), names.slice(0, 2).join(', '));

    const cookieHeader = `sb-access-token=${TOKEN.alice}`;
    const nonMember = await post('/api/dsg/access/workspace', { workspaceId: WS.two }, cookieHeader);
    check('[B9] selecting a workspace the user is NOT a member of -> 403 and no workspace cookie', nonMember.status === 403 && !(nonMember.headers['set-cookie'] || []).some((c) => c.startsWith('dsg-workspace-id=')), `${nonMember.status} ${nonMember.text.slice(0, 70)}`);
    const noSession = await post('/api/dsg/access/workspace', { workspaceId: WS.one });
    check('[B9] selecting a workspace without a session -> 401', noSession.status === 401, `${noSession.status}`);
    const forgedSession = await post('/api/dsg/access/workspace', { workspaceId: WS.one }, `sb-access-token=${jwtFor(ID.alice)}x`);
    check('[B9] selecting a workspace with a forged session token -> 401', forgedSession.status === 401, `${forgedSession.status}`);
    await ctx.close();
  }
}

// ═════════ Part C: who can make the SERVER spend its own provider credentials?
// The fake providers above record every call. Anonymous or under-privileged callers must cause none.
console.log('\n── Part C: server-held provider credentials');
{
  const hub = (prefix) => providerLog.filter((r) => r.path.startsWith(prefix));
  const send = (c, headers = {}) => {
    const body = c.body ? JSON.stringify(c.body) : undefined;
    return raw(c.method, c.path, { ...(body ? { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(body)) } : {}), ...headers }, body);
  };
  const asAlice = { ...bearer(TOKEN.alice), 'x-dsg-workspace-id': WS.one };
  const asCarol = { ...bearer(TOKEN.carol), 'x-dsg-workspace-id': WS.one };
  const routes = [
    { name: 'ai-gateway execute:true', method: 'POST', path: '/api/dsg/ai-gateway', body: { provider: 'openai', goal: 'e2e goal', prompt: 'say hi', execute: true }, prefix: '/openai', needs: 'skill:execute' },
    { name: 'openai chat', method: 'POST', path: '/api/dsg/ai/openai/chat', body: { input: 'hi' }, prefix: '/openai', needs: 'job:plan' },
    { name: 'design-draft', method: 'POST', path: '/api/dsg/app-builder/design-draft', body: { message: 'a todo app', history: [] }, prefix: '/openai', needs: 'job:plan' },
    { name: 'katzilla query', method: 'POST', path: '/api/dsg/katzilla/query', body: { path: '/agents' }, prefix: '/agents', needs: 'skill:execute' },
    { name: 'katzilla agents', method: 'GET', path: '/api/dsg/katzilla/agents', prefix: '/agents', needs: 'skill:read' },
  ];

  // C1: anonymous callers
  for (const r of [...routes,
    { name: 'lifecycle event (victim email)', method: 'POST', path: '/api/dsg/lifecycle/event', body: { event: 'proof_viewed', email: 'victim@example.test' }, prefix: '/ac' },
    { name: 'app-builder proof with an email', method: 'POST', path: '/api/dsg/app-builder/proof', body: { goal: 'Build a CRM dashboard for the e2e check', email: 'victim@example.test' }, prefix: '/ac' }]) {
    const before = hub(r.prefix).length;
    const res = await send(r);
    const made = hub(r.prefix).length - before;
    check(`[C1] anonymous ${r.name}: the server makes NO provider call with its credentials`, made === 0, `status=${res.status} provider-calls=${made}`);
  }
  const anonProof = await raw('GET', '/api/dsg/app-builder/proof');
  check('[C1] the public deterministic proof (GET, used by the production smoke) still works anonymously', anonProof.status === 200 && JSON.parse(anonProof.text).ok === true, `${anonProof.status}`);

  // C2: a verified OPERATOR still gets the work done (nothing broken for real users)
  for (const r of routes) {
    const before = hub(r.prefix).length;
    const res = await send(r, asAlice);
    const calls = hub(r.prefix).slice(before);
    const key = r.prefix === '/agents' ? calls[0]?.apiKey : calls[0]?.authorization;
    const expected = r.prefix === '/agents' ? PROVIDER_KEYS.katzilla : `Bearer ${PROVIDER_KEYS.openai}`;
    check(`[C2] verified OPERATOR ${r.name}: reaches the provider with the server-held key`, calls.length >= 1 && key === expected, `status=${res.status} provider-calls=${calls.length}`);
  }
  {
    const before = hub('/ac').length;
    const res = await send({ method: 'POST', path: '/api/dsg/lifecycle/event', body: { event: 'proof_viewed', email: 'alice@example.test' } }, bearer(TOKEN.alice));
    const calls = hub('/ac').slice(before);
    check('[C2] verified user\'s own-account lifecycle event is delivered (contact lookup for her email)', res.status === 200 && calls.some((c) => c.path.includes('email=alice%40example.test')), `status=${res.status} calls=${calls.length}`);
    const before2 = hub('/ac').length;
    const other = await send({ method: 'POST', path: '/api/dsg/lifecycle/event', body: { event: 'proof_viewed', email: 'victim@example.test' } }, bearer(TOKEN.alice));
    const calls2 = hub('/ac').slice(before2);
    check('[C2] a verified user cannot tag SOMEONE ELSE\'s email (no lookup for victim@)', !calls2.some((c) => c.path.includes('victim')), `status=${other.status} calls=${calls2.length}`);
    check('[C2] the response does not reveal whether an arbitrary email is a CRM contact', !/CONTACT_NOT_FOUND/.test(other.text), other.text.slice(0, 90));
  }

  // C3: a VIEWER may read but must not trigger paid/planning calls
  for (const r of routes) {
    const before = hub(r.prefix).length;
    const res = await send(r, asCarol);
    const made = hub(r.prefix).length - before;
    const allowed = r.needs === 'skill:read';
    check(`[C3] VIEWER ${r.name} (needs ${r.needs}): ${allowed ? 'allowed' : 'refused 403, no provider call'}`, allowed ? made >= 1 : (res.status === 403 && made === 0), `status=${res.status} provider-calls=${made}`);
  }
  // C4: a forged / non-member credential never reaches a provider either
  {
    const before = providerLog.length;
    const res = await send(routes[0], { ...bearer(jwtFor(ID.alice) + 'x'), 'x-dsg-workspace-id': WS.one });
    const notMember = await send(routes[1], { ...bearer(TOKEN.alice), 'x-dsg-workspace-id': WS.two });
    check('[C4] forged token / non-member workspace on the provider routes -> 401/403 and no provider call', [res.status, notMember.status].every((c) => c === 401 || c === 403) && providerLog.length === before, `${res.status}/${notMember.status} calls=${providerLog.length - before}`);
  }
}

// C5: the server-side agents (Z3 / search / loopback calls) need a verified member of the claimed workspace
{
  const agentRoutes = ['orchestrator', 'code-evolution', 'deploy-monitor', 'browser-research', 'security-gate', 'test-coverage'];
  const payload = { jobId: 'job-e2e', workspaceId: WS.one, goal: 'e2e goal', actionId: 'a1', agentType: 'x', deploymentUrl: 'https://example.com', researchQuery: 'q', previousCoveragePct: 80, currentCoveragePct: 82, subGoals: [] };
  const body = JSON.stringify(payload);
  const hdr = { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(body)) };
  const anon = await Promise.all(agentRoutes.map((r) => raw('POST', `/api/dsg/agents/${r}`, hdr, body)));
  check('[C5] anonymous POST to all 6 /api/dsg/agents/* routes -> 401 (no server-side skill runs)', anon.every((r) => r.status === 401), anon.map((r) => r.status).join(','));
  const wrongWs = await Promise.all(agentRoutes.map((r) => raw('POST', `/api/dsg/agents/${r}`, { ...hdr, ...bearer(TOKEN.alice), 'x-dsg-workspace-id': WS.one }, JSON.stringify({ ...payload, workspaceId: WS.two }))));
  check('[C5] a workspace id in the body that is not the session\'s -> 403 DSG_WORKSPACE_MISMATCH on every agent route', wrongWs.every((r) => r.status === 403 && codeOf(r) === 'DSG_WORKSPACE_MISMATCH'), wrongWs.map((r) => `${r.status}`).join(','));
  const viewer = await raw('POST', '/api/dsg/agents/orchestrator', { ...hdr, ...bearer(TOKEN.carol), 'x-dsg-workspace-id': WS.one }, body);
  check('[C5] a VIEWER cannot start the orchestrator -> 403', viewer.status === 403, `${viewer.status}`);
}

// C6: an operator cannot approve their own request through the execution routes (human approval stays human)
{
  const approve = JSON.stringify({ capability: 'browser.remote.execute', payload: { action: 'browser.remote.run', arguments: { url: 'https://example.com' } }, approvalRequestId: 'approval-e2e', approvalDecision: 'APPROVE' });
  const h = { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(approve)), ...bearer(TOKEN.alice), 'x-dsg-workspace-id': WS.one };
  const res = await raw('POST', '/api/agent/execute', h, approve);
  check('[C6] /api/agent/execute with approvalDecision=APPROVE (OPERATOR) -> 403 DSG_HUMAN_APPROVAL_REQUIRED', res.status === 403 && codeOf(res) === 'DSG_HUMAN_APPROVAL_REQUIRED', `${res.status} ${codeOf(res)}`);
  const auto = JSON.stringify({ action: 'EXECUTE', taskId: 't1', capability: 'browser.remote.execute', approvalDecision: 'APPROVE' });
  const res2 = await raw('POST', '/api/dsg/jobs/33333333-3333-4333-8333-333333333333/automation', { ...h, 'content-length': String(Buffer.byteLength(auto)) }, auto);
  check('[C6] /api/dsg/jobs/<id>/automation EXECUTE with APPROVE (OPERATOR) -> 403 DSG_HUMAN_APPROVAL_REQUIRED', res2.status === 403 && codeOf(res2) === 'DSG_HUMAN_APPROVAL_REQUIRED', `${res2.status} ${codeOf(res2)}`);
}

// ═════════ Part D: pages must stay usable when the network or an API fails (Workspace / Workroom / Verify)
console.log('\n── Part D: failure handling and accessible names');
{
  // D1/D3: the workspace-selection POST fails -> one automatic attempt only, a visible error, buttons usable again
  for (const [route, shape] of [['/dsg/access', 'network'], ['/dsg/workroom', 'network'], ['/dsg/access', 'http500'], ['/dsg/workroom', 'http500']]) {
    const { ctx, page } = await sessionPage({ token: TOKEN.alice });
    let posts = 0;
    await page.route('**/api/dsg/access/workspace', (r) => { posts += 1; return shape === 'network' ? r.abort('failed') : json(r, 500, { ok: false, error: 'boom' }); });
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const body = await page.locator('body').innerText();
    check(`[D1] ${route} (${shape}): a failing workspace activation is tried once automatically, not in an endless loop`, posts >= 1 && posts <= 2, `POSTs in 3s = ${posts}`);
    check(`[D1] ${route} (${shape}): the failure is shown with a next step (not stuck on "Loading")`, /ไม่สำเร็จ/.test(body), body.match(/.{0,40}ไม่สำเร็จ.{0,40}/)?.[0] || 'no failure text');
    const enabled = await page.locator('button:has-text("Use this workspace"), button:has-text("Active session workspace")').first().isEnabled().catch(() => false);
    check(`[D1] ${route} (${shape}): the workspace button is clickable again so the user can retry`, enabled);
    await ctx.close();
  }
  // D2/D4: the session endpoint is down -> an honest error, not an eternal "Loading…"
  for (const route of ['/dsg/access', '/dsg/workroom']) {
    const { ctx, page } = await sessionPage({ token: TOKEN.alice, workspace: WS.one });
    await page.route('**/api/dsg/access/session', (r) => json(r, 500, { ok: false }));
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const body = await page.locator('body').innerText();
    check(`[D2] ${route}: session API 500 -> an error with HTTP code and how to retry (no endless "Loading…")`, /ไม่สำเร็จ.*500|500.*ไม่สำเร็จ/s.test(body) && !/Loading authenticated/.test(body), body.match(/.{0,50}(Loading authenticated|ไม่สำเร็จ).{0,50}/)?.[0]);
    await ctx.close();
  }
  // D5: verify - telemetry down must not break the verification, and the page must not claim it was recorded
  {
    const { ctx, page } = await sessionPage({ token: TOKEN.alice, workspace: WS.one });
    await page.route('**/api/dsg/lifecycle/event', (r) => r.abort('failed'));
    await page.goto(`${BASE}/dsg/verify`, { waitUntil: 'networkidle' });
    await page.locator('input[type=email]').fill('alice@example.test');
    await page.getByRole('button', { name: 'Verify one AI action' }).click();
    const gotReceipt = await page.getByText('Your verification receipt').waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
    check('[D5] /dsg/verify: the verification still completes when the lifecycle telemetry endpoint is down', gotReceipt);
    await page.waitForTimeout(800);
    check('[D5] /dsg/verify: it does NOT claim "event recorded" when the event was not delivered', !(await page.getByText(/event recorded/i).count()));
    await ctx.close();
  }
  // D6: verify - when blocked without a proof, the reasons are shown (and announced)
  {
    const { ctx, page } = await sessionPage({ token: TOKEN.alice, workspace: WS.one });
    await page.route('**/api/dsg/lifecycle/event', (r) => json(r, 200, { ok: true, delivery: { delivered: false } }));
    await page.route('**/api/dsg/app-builder/proof', (r) => r.request().method() === 'POST'
      ? json(r, 422, { ok: false, runtimeGate: { status: 'BLOCKED', failures: [{ code: 'EXECUTOR_NOT_CONFIGURED', message: 'No executor is configured for this goal' }] } })
      : r.continue());
    await page.goto(`${BASE}/dsg/verify`, { waitUntil: 'networkidle' });
    await page.locator('input[type=email]').fill('alice@example.test');
    await page.getByRole('button', { name: 'Verify one AI action' }).click();
    await page.waitForTimeout(1200);
    check('[D6] /dsg/verify: a blocked result without a proof still lists WHY (failures are not hidden)', (await page.getByText('No executor is configured for this goal').count()) > 0);
    check('[D6] /dsg/verify: the error is announced to assistive tech (role=alert)', (await page.locator('[role=alert]').count()) > 0);
    await ctx.close();
  }
  // D7: every control on the key pages has an accessible name; one h1; no horizontal scroll (360px)
  {
    const pages = ['/login', '/dsg/access', '/dsg/workroom', '/dsg/approvals', '/dsg/verify', '/dsg/history'];
    for (const route of pages) {
      const { ctx, page } = await sessionPage({ token: route === '/login' ? undefined : TOKEN.alice, workspace: route === '/login' ? undefined : WS.one, viewport: { width: 360, height: 800 } });
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      const audit = await page.evaluate(() => {
        const nameOf = (el) => {
          const aria = el.getAttribute('aria-label') || '';
          const by = (el.getAttribute('aria-labelledby') || '').split(/\s+/).map((id) => document.getElementById(id)?.textContent || '').join(' ');
          const labels = el.labels ? [...el.labels].map((l) => l.textContent || '').join(' ') : '';
          const text = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' ? '' : (el.textContent || '');
          const alt = el.querySelector('img[alt]')?.getAttribute('alt') || '';
          return (aria + by + labels + text + alt + (el.getAttribute('title') || '')).trim();
        };
        const controls = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea')]
          .filter((el) => el.getBoundingClientRect().width > 0 && getComputedStyle(el).visibility !== 'hidden');
        const unnamed = controls.filter((el) => !nameOf(el)).map((el) => `${el.tagName.toLowerCase()}${el.getAttribute('type') ? `[${el.getAttribute('type')}]` : ''}`);
        const small = controls.filter((el) => { const r = el.getBoundingClientRect(); return r.height < 40 || r.width < 40; }).length;
        return { unnamed, small, h1: document.querySelectorAll('h1').length, overflow: document.documentElement.scrollWidth > innerWidth + 1, controls: controls.length };
      });
      check(`[D7] ${route}: every control has an accessible name`, audit.unnamed.length === 0, `unnamed=${JSON.stringify(audit.unnamed)} of ${audit.controls}`);
      check(`[D7] ${route}: exactly one h1 and no horizontal scroll at 360px`, audit.h1 === 1 && !audit.overflow, `h1=${audit.h1} overflow=${audit.overflow}`);
      console.log(`   info ${route}: ${audit.small} of ${audit.controls} controls are under 40px (not asserted)`);
      await ctx.close();
    }
  }
}

// ═════════ Part E: Analytics and Notifications show the caller's own real rows (they used to be hard-coded demo data)
console.log('\n── Part E: analytics and notifications are real, scoped and honest');
{
  const H = (tok = TOKEN.alice, ws = WS.one) => ({ ...bearer(tok), 'x-dsg-workspace-id': ws });
  const patch = (body, tok = TOKEN.alice, ws = WS.one) => { const text = JSON.stringify(body); return raw('PATCH', '/api/dsg/notifications', { ...H(tok, ws), 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(text)) }, text); };
  const DEMO = /Inventory Tracker|Payments Portal|Customer Portal|Provider Usage|Gemini|Anthropic|AI Tokens/;

  // E1: analytics API
  const none = await raw('GET', '/api/dsg/analytics');
  check('[E1] /api/dsg/analytics without credentials -> 401 DSG_AUTH_REQUIRED', none.status === 401 && codeOf(none) === 'DSG_AUTH_REQUIRED', `${none.status} ${codeOf(none)}`);
  const a7 = await raw('GET', '/api/dsg/analytics?range=7d', H());
  const d7 = JSON.parse(a7.text).data;
  check('[E1] counts only the caller\'s 12 builds (3 deployed, 3 failed -> 50%); bob\'s rows never appear', a7.status === 200 && d7.stats.totalBuilds === 12 && d7.stats.deployed === 3 && d7.stats.failed === 3 && d7.stats.successRate === 50 && !a7.text.includes('Bob Secret'), `${a7.status} ${JSON.stringify(d7?.stats)}`);
  check('[E1] nothing is estimated: no token / cost / provider figures in the payload', !/token|cost|provider|updatedEvery/i.test(a7.text));
  check('[E1] the newest build is listed with its real name (the old API returned an empty name)', d7.recentBuilds[0].appName === 'Alice App 1' && d7.recentBuilds.length === 10, d7.recentBuilds[0]?.appName);
  const shape = {};
  for (const r of ['7d', '30d', '90d', 'bogus']) {
    const res = await raw('GET', `/api/dsg/analytics?range=${r}`, H());
    const data = JSON.parse(res.text).data;
    shape[r] = `${data.range}:${data.buildActivity.length}bars:${data.buildActivity.reduce((n, b) => n + b.builds, 0)}`;
  }
  check('[E1] each range really changes the chart (7d=7 bars, 30d=6, 90d=9; unknown range -> 7d); every build is counted once', shape['7d'] === '7d:7bars:12' && shape['30d'] === '30d:6bars:12' && shape['90d'] === '90d:9bars:12' && shape.bogus === '7d:7bars:12', JSON.stringify(shape));
  const other = await raw('GET', '/api/dsg/analytics?range=7d', H(TOKEN.bob, WS.two));
  const otherData = JSON.parse(other.text).data;
  check('[E1] another user sees only their own builds (bob: 3, none of alice\'s)', otherData.stats.totalBuilds === 3 && !other.text.includes('Alice App'), `${otherData?.stats?.totalBuilds}`);
  fake.mode = 'dberror';
  const dbErr = await raw('GET', '/api/dsg/analytics', H());
  check('[E1] DB error -> 500 ANALYTICS_FETCH_FAILED with no table/driver text', dbErr.status === 500 && codeOf(dbErr) === 'ANALYTICS_FETCH_FAILED' && !dbErr.text.includes(DB_ERROR_MARKER) && !dbErr.text.includes('dsg_app_builds'), `${dbErr.status} ${dbErr.text.slice(0, 80)}`);
  fake.mode = 'ok';

  // E2: analytics page
  {
    const { ctx, page, errors } = await sessionPage({ token: TOKEN.alice, workspace: WS.one });
    const requested = [];
    page.on('request', (r) => { if (r.url().includes('/api/dsg/analytics')) requested.push(new URL(r.url()).searchParams.get('range')); });
    await page.goto(`${BASE}/dsg/analytics`, { waitUntil: 'domcontentloaded' });
    const shown = await page.getByText('Alice App 1').first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
    const body = await page.locator('body').innerText();
    check('[E2] /dsg/analytics shows the caller\'s real builds and rate, no demo figures', shown && /50%/.test(body) && !DEMO.test(body) && !body.includes('Bob Secret'), body.match(DEMO)?.[0] || '');
    check('[E2] it says tokens / cost are not recorded instead of showing an estimate', /ยังไม่เก็บจำนวน token/.test(body));
    await page.getByRole('button', { name: '30 วัน' }).click();
    check('[E2] choosing 30 วัน calls the API with range=30d and marks the button pressed', await until(async () => requested.includes('30d')) && (await page.getByRole('button', { name: '30 วัน' }).getAttribute('aria-pressed')) === 'true', requested.join(','));
    check('[E2] no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  {
    const { ctx, page } = await sessionPage({ token: TOKEN.alice, workspace: WS.one });
    fake.mode = 'dberror';
    await page.goto(`${BASE}/dsg/analytics`, { waitUntil: 'domcontentloaded' });
    await page.locator('[role=alert]').filter({ hasText: 'HTTP 500' }).waitFor({ timeout: 8000 });
    const html = await page.content();
    check('[E2] API failure -> role=alert with HTTP 500 + retry; no DB text, no demo data', !html.includes(DB_ERROR_MARKER) && !html.includes('dsg_app_builds') && !DEMO.test(await page.locator('body').innerText()));
    fake.mode = 'ok';
    await page.getByRole('button', { name: 'ลองอีกครั้ง' }).click();
    check('[E2] retry after recovery shows the real rows', await page.getByText('Alice App 1').first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false));
    await ctx.close();
  }
  {
    const { ctx, page } = await sessionPage({ token: TOKEN.carol, workspace: WS.one, viewport: { width: 360, height: 800 } });
    await page.goto(`${BASE}/dsg/analytics`, { waitUntil: 'domcontentloaded' });
    const empty = await page.getByText(/ยังไม่มี build ในช่วง 7 วัน/).waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
    check('[E2] a user with no builds sees an honest empty state with a next step (not a demo chart)', empty && (await page.getByRole('link', { name: 'ไปที่ App Builder' }).count()) === 1 && !DEMO.test(await page.locator('body').innerText()));
    check('[E2] no horizontal scroll at 360px', !(await overflow(page)));
    await ctx.close();
  }

  // E3: notifications API
  const nNone = await raw('GET', '/api/dsg/notifications');
  check('[E3] /api/dsg/notifications without credentials -> 401', nNone.status === 401 && codeOf(nNone) === 'DSG_AUTH_REQUIRED', `${nNone.status}`);
  const nAll = JSON.parse((await raw('GET', '/api/dsg/notifications?filter=ALL', H())).text).data;
  check('[E3] list returns only the caller\'s 5 notifications (3 unread); bob\'s is never visible', nAll.total === 5 && nAll.unreadCount === 3 && !JSON.stringify(nAll).includes('Bob Secret'), `${nAll.total}/${nAll.unreadCount}`);
  const nUnread = JSON.parse((await raw('GET', '/api/dsg/notifications?filter=UNREAD', H())).text).data;
  const nBuilds = JSON.parse((await raw('GET', '/api/dsg/notifications?filter=BUILDS', H())).text).data;
  check('[E3] filters are applied by the server (UNREAD=3, BUILDS=only build events)', nUnread.items.length === 3 && nBuilds.items.length === 2 && nBuilds.items.every((n) => n.type.startsWith('BUILD_')), `${nUnread.items.length}/${nBuilds.items.length}`);
  const foreign = await patch({ id: NOTIF_IDS.bob });
  const bobAfter = JSON.parse((await raw('GET', '/api/dsg/notifications?filter=UNREAD', H(TOKEN.bob, WS.two))).text).data;
  check('[E3] alice cannot mark bob\'s notification (404) and it stays unread', foreign.status === 404 && codeOf(foreign) === 'NOTIFICATION_NOT_FOUND' && bobAfter.unreadCount === 1, `${foreign.status} bobUnread=${bobAfter.unreadCount}`);
  const badId = await patch({ id: 'not-a-uuid&user_id=neq.x' });
  check('[E3] a malformed id is refused (400) before any database call', badId.status === 400 && codeOf(badId) === 'NOTIFICATIONS_PATCH_INVALID_BODY', `${badId.status}`);
  const one = await patch({ id: NOTIF_IDS.failed });
  const afterOne = JSON.parse((await raw('GET', '/api/dsg/notifications', H())).text).data;
  check('[E3] marking one notification read persists on the server (unread 3 -> 2)', one.status === 200 && afterOne.unreadCount === 2, `${one.status} unread=${afterOne.unreadCount}`);
  fake.mode = 'dberror';
  const nDb = await raw('GET', '/api/dsg/notifications', H());
  const nDbPatch = await patch({ markAll: true });
  check('[E3] DB errors on read and on write -> 500 with a generic code, no table/driver text', nDb.status === 500 && nDbPatch.status === 500 && ![nDb.text, nDbPatch.text].some((t) => t.includes(DB_ERROR_MARKER) || t.includes('dsg_notifications')), `${nDb.status} ${nDbPatch.status}`);
  fake.mode = 'ok';
  NOTIFS = seedNotifs();

  // E4: notifications page
  {
    const { ctx, page, errors } = await sessionPage({ token: TOKEN.alice, workspace: WS.one });
    await page.goto(`${BASE}/dsg/notifications`, { waitUntil: 'domcontentloaded' });
    const shown = await page.getByText('Alice build failed').first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
    const body = await page.locator('body').innerText();
    check('[E4] /dsg/notifications lists the caller\'s real notifications, none of the demo ones, none of bob\'s', shown && /ยังไม่ได้อ่าน 3/.test(body) && !DEMO.test(body) && !/Auth Service|Welcome to DSG One|Bob Secret/.test(body), body.match(DEMO)?.[0] || '');
    check('[E4] no switches for email / Slack that do nothing (and the page says why)', (await page.locator('[role=switch]').count()) === 0 && /ยังไม่เปิดให้ใช้/.test(body));
    await page.getByRole('button', { name: 'ทำเครื่องหมายว่าอ่านแล้ว' }).first().click();
    const dropped = await page.getByText('ยังไม่ได้อ่าน 2').waitFor({ timeout: 6000 }).then(() => true).catch(() => false);
    const serverUnread = JSON.parse((await raw('GET', '/api/dsg/notifications', H())).text).data.unreadCount;
    check('[E4] pressing "mark as read" changes the server state, not just the screen (3 -> 2)', dropped && serverUnread === 2, `ui=${dropped} server=${serverUnread}`);
    await page.getByRole('button', { name: 'ทำเครื่องหมายว่าอ่านทั้งหมด' }).click();
    const allRead = await page.getByText('ยังไม่ได้อ่าน 0').waitFor({ timeout: 6000 }).then(() => true).catch(() => false);
    check('[E4] "mark all as read" empties the unread count on the server and hides the button', allRead && JSON.parse((await raw('GET', '/api/dsg/notifications', H())).text).data.unreadCount === 0 && (await page.getByRole('button', { name: 'ทำเครื่องหมายว่าอ่านทั้งหมด' }).count()) === 0);
    await page.getByRole('button', { name: 'Builds' }).click();
    check('[E4] the Builds tab shows only build events', await until(async () => (await page.locator('ol > li').count()) === 2) && !(await page.locator('body').innerText()).includes('Alice approval waiting'));
    check('[E4] no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  NOTIFS = seedNotifs();
  {
    const { ctx, page } = await sessionPage({ token: TOKEN.alice, workspace: WS.one });
    await page.route('**/api/dsg/notifications', (r) => (r.request().method() === 'PATCH' ? r.abort('failed') : r.continue()));
    await page.goto(`${BASE}/dsg/notifications`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'ทำเครื่องหมายว่าอ่านแล้ว' }).first().click();
    const msg = await page.locator('[role=alert]').filter({ hasText: 'ไม่สำเร็จ' }).waitFor({ timeout: 6000 }).then(() => true).catch(() => false);
    check('[E4] a failed "mark as read" is reported (role=alert) and the unread count is NOT lowered', msg && /ยังไม่ได้อ่าน 3/.test(await page.locator('body').innerText()));
    await ctx.close();
  }
  {
    const { ctx, page } = await sessionPage({ token: TOKEN.alice, workspace: WS.one });
    fake.mode = 'dberror';
    await page.goto(`${BASE}/dsg/notifications`, { waitUntil: 'domcontentloaded' });
    await page.locator('[role=alert]').filter({ hasText: 'HTTP 500' }).waitFor({ timeout: 8000 });
    const html = await page.content();
    check('[E4] load failure -> role=alert with HTTP 500 and a retry; no DB text, no demo list', !html.includes(DB_ERROR_MARKER) && !html.includes('dsg_notifications') && !DEMO.test(await page.locator('body').innerText()));
    fake.mode = 'ok';
    await page.getByRole('button', { name: 'ลองอีกครั้ง' }).click();
    check('[E4] retry after recovery shows the real list', await page.getByText('Alice build failed').first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false));
    await ctx.close();
  }
  {
    const { ctx, page } = await sessionPage({ token: TOKEN.carol, workspace: WS.one, viewport: { width: 360, height: 800 } });
    await page.goto(`${BASE}/dsg/notifications`, { waitUntil: 'domcontentloaded' });
    const empty = await page.getByText('ยังไม่มีการแจ้งเตือน').waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
    check('[E4] a user with no notifications sees an honest empty state pointing to Approvals and History', empty && (await page.getByRole('link', { name: 'ไปหน้าอนุมัติ' }).count()) === 1 && (await page.getByRole('link', { name: 'ดูประวัติ build' }).count()) === 1);
    check('[E4] no horizontal scroll at 360px', !(await overflow(page)));
    await ctx.close();
  }
}

await browser.close();
shutdown();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) { console.log('FAILED:', failed.map((f) => f.name)); process.exit(1); }
process.exit(0);
