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
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const { chromium } = await import(process.env.PLAYWRIGHT_CORE || 'playwright-core');

const APP_PORT = Number(process.env.E2E_APP_PORT || 18190);
const FAKE_PORT = Number(process.env.E2E_FAKE_PORT || 18191);
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
const fake = { mode: 'ok' };
const DB_ERROR_MARKER = 'E2E-SECRET-MARKER';

const eq = (value) => (typeof value === 'string' && value.startsWith('eq.') ? value.slice(3) : undefined);
const fakeServer = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${FAKE_PORT}`);
  const send = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (url.pathname === '/auth/v1/user') {
    const token = (req.headers.authorization || '').replace(/^Bearer /i, '');
    const id = USER_BY_TOKEN.get(token);
    return id ? send(200, { id }) : send(401, { message: 'invalid JWT' });
  }
  if (url.pathname === '/rest/v1/dsg_workspace_members') {
    const rows = MEMBERS.filter((m) => m.workspace_id === eq(url.searchParams.get('workspace_id')) && m.actor_id === eq(url.searchParams.get('actor_id')));
    return send(200, rows.slice(0, 1).map((m) => ({ role: m.role })));
  }
  if (url.pathname === '/rest/v1/dsg_app_builds') {
    if (fake.mode === 'dberror') return send(400, { message: `relation "dsg_app_builds" does not exist (${DB_ERROR_MARKER})` });
    const status = eq(url.searchParams.get('status'));
    const rows = BUILDS.filter((b) => b.user_id === eq(url.searchParams.get('user_id')) && (!status || b.status === status))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return send(200, rows);
  }
  return send(404, { message: 'not found in fake supabase' });
});
await new Promise((resolve) => fakeServer.listen(FAKE_PORT, '127.0.0.1', resolve));

// ───────── the built app, pointed at the fake
const env = { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' };
for (const name of ['DSG_ONE_V1_SUPABASE_URL', 'NEXT_PUBLIC_DSG_ONE_V1_SUPABASE_URL', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL',
  'DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'DSG_ALLOW_DEV_HEADER_ACTOR', 'DSG_ALLOW_DEV_AUTH_HEADERS']) delete env[name];
env.DSG_ONE_V1_SUPABASE_URL = `http://127.0.0.1:${FAKE_PORT}`;
env.DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY = 'local-e2e-fake-key-not-a-secret';
const nextBin = path.join(process.cwd(), 'node_modules', '.bin', 'next');
const app = spawn(nextBin, ['start', '-p', String(APP_PORT), '-H', '127.0.0.1'], { env, stdio: 'ignore' });
const shutdown = () => { app.kill('SIGTERM'); fakeServer.close(); };
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
    res.on('end', () => resolve({ status: res.statusCode, text }));
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

await browser.close();
shutdown();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) { console.log('FAILED:', failed.map((f) => f.name)); process.exit(1); }
process.exit(0);
