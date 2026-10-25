/** Rendered UI regression checks against a LOCAL Next build only.
 * All identities/API data below are explicit UI fixtures. No external request,
 * provider execution, real approval, signature verification or production proof.
 * Tool packages live outside the application dependency tree (see CI workflow).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const base = new URL(process.env.DSG_UI_APP_URL || 'http://127.0.0.1:3030');
if (!['127.0.0.1', 'localhost'].includes(base.hostname) || base.protocol !== 'http:') throw new Error('UI fixtures are restricted to a local HTTP build');
const requireTools = createRequire(path.join(process.env.DSG_UI_TOOLS_DIR || process.cwd(), 'package.json'));
const { chromium } = requireTools('playwright');
const axeSource = await fs.readFile(requireTools.resolve('axe-core/axe.min.js'), 'utf8');
const output = process.env.DSG_UI_OUTPUT || '/tmp/dsg-all-pages-ui';
await fs.mkdir(output, { recursive: true });

async function findPages(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory() ? findPages(path.join(directory, entry.name)) : entry.name === 'page.tsx' ? [path.join(directory, entry.name)] : []));
  return nested.flat();
}
const routes = (await findPages('app')).map(file => file === 'app/page.tsx' ? '/' : '/' + file.slice(4, -9).replace('[jobId]', 'ui-fixture-job')).sort();
const jobs = Array.from({ length: 14 }, (_, index) => ({
  id: `ui-fixture-job-${index + 1}`, goal: index === 0 ? 'UI fixture · Alpha' : `UI fixture · งาน ${index + 1}`,
  status: ['QUEUED', 'RUNNING', 'AWAITING_APPROVAL', 'BLOCKED', 'COMPLETED'][index % 5],
  completionReportId: index === 9 ? 'ui-fixture-report' : null,
}));
const fixtureSession = { ok: true, selected: { workspace_id: 'ui-fixture-workspace', role: 'OWNER' }, memberships: [{ workspace_id: 'ui-fixture-workspace', role: 'OWNER' }] };
let readMode = 'ready';
const requests = [];
const checks = [];
const issues = [];
const browser = await chromium.launch({ headless: true,
  ...(process.env.DSG_UI_CHROMIUM ? { executablePath: process.env.DSG_UI_CHROMIUM, args: ['--no-sandbox', '--disable-gpu', '--use-gl=disabled'] } : {}),
});

function check(name, condition, details = {}) {
  checks.push({ name, pass: !!condition, ...details });
  if (!condition) issues.push({ name, ...details });
}

async function fixture(route) {
  const request = route.request();
  const url = new URL(request.url());
  if (url.origin !== base.origin) return route.abort('blockedbyclient');
  if (!url.pathname.startsWith('/api/')) return route.continue();
  requests.push({ path: url.pathname, method: request.method(), fixture: true });
  const respond = (json, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(json) });
  if (request.method() !== 'GET') return respond({ ok: false, error: { code: 'UI_FIXTURE_WRITE_DISABLED' } }, 403);
  if (url.pathname === '/api/dsg/access/session') return respond(fixtureSession);
  if (url.pathname === '/api/dsg/agent-chat') return respond({ ok: true, data: { messages: [], modelConnection: { openai: false, gemini: false } } });
  if (url.pathname === '/api/dsg/jobs') {
    if (readMode === 'failed') return respond({ ok: false }, 503);
    return respond(readMode === 'malformed' ? { ok: true, data: { jobs: [{}] } } : { ok: true, data: { jobs: readMode === 'empty' ? [] : jobs } });
  }
  if (url.pathname.startsWith('/api/dsg/jobs/')) return respond({ ok: true, data: { job: jobs[0], events: [{ type: 'UI_FIXTURE_EVENT' }], evidenceItems: [], evidenceManifests: [], completionReports: [], replayProofs: [] } });
  if (url.pathname === '/api/dsg/app-builder/jobs') return respond({ ok: true, data: { jobs: [] } });
  return respond({ ok: false, error: { code: 'UI_FIXTURE_SERVICE_UNAVAILABLE', message: 'Local UI fixture: service unavailable' } }, 403);
}

async function contextFor(width, touch = false) {
  const context = await browser.newContext({ viewport: { width, height: 960 }, hasTouch: touch, isMobile: touch });
  // An intentionally non-authoritative local cookie reaches the rendered shell.
  // All data APIs are separately intercepted and never reach a real service.
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  await context.addCookies([{ name: 'sb-access-token', value: `local-ui-fixture.${payload}.local-ui-fixture`, url: base.origin }]);
  await context.route('**/*', fixture);
  return context;
}

try {
  const guest = await browser.newContext();
  const guestResponse = await guest.request.get(base.origin + '/dsg/history', { maxRedirects: 0 });
  check('Unmodified protected-page middleware requires sign-in', guestResponse.status() === 307 && guestResponse.headers().location?.includes('/login'));
  await guest.close();

  for (const width of [320, 390, 1440]) {
    const context = await contextFor(width, width < 600);
    const page = await context.newPage();
    for (const route of routes) {
      const pageErrors = [];
      const onError = error => pageErrors.push(error.message.slice(0, 220));
      page.on('pageerror', onError);
      try {
        const response = await page.goto(base.origin + route, { waitUntil: 'networkidle' });
        check('Page responds', !!response && response.status() < 400, { route, width, status: response?.status() });
        if (route === '/dsg/workroom') await page.getByRole('region', { name: 'แชท DSG ONE', exact: true }).waitFor();
        const geometry = await page.evaluate(() => {
          const content = document.querySelector('.dsg-app-content');
          return { rootWidth: document.documentElement.clientWidth, rootScroll: document.documentElement.scrollWidth,
            contentWidth: content?.clientWidth, contentScroll: content?.scrollWidth,
            mainCount: [...document.querySelectorAll('main')].filter(node => node.getClientRects().length).length,
            h1Count: [...document.querySelectorAll('h1')].filter(node => node.getClientRects().length).length };
        });
        check('Page reflows without horizontal page scrolling', geometry.rootScroll <= geometry.rootWidth + 1 && (!geometry.contentWidth || geometry.contentScroll <= geometry.contentWidth + 1), { route, width, geometry });
        check('One visible main landmark', geometry.mainCount === 1, { route, width, count: geometry.mainCount });
        check('One visible primary heading', geometry.h1Count === 1, { route, width, count: geometry.h1Count });
        check('No unhandled client error', pageErrors.length === 0, { route, width, errors: pageErrors });
        if (width !== 320) {
          await page.addScriptTag({ content: axeSource });
          const audit = await page.evaluate(async () => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } }));
          check('Automated accessibility rules', audit.violations.length === 0, { route, width, violations: audit.violations.map(violation => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.map(node => ({ target: node.target, summary: node.failureSummary?.slice(0, 260) })) })) });
        }
        if (width === 390 && ['/dsg/history', '/dsg/workroom', '/dsg/app-builder', '/enterprise/security'].includes(route)) await page.screenshot({ path: path.join(output, route.slice(1).replaceAll('/', '-') + '-390.png') });
      } catch (error) { check('Page can be inspected', false, { route, width, error: String(error).slice(0, 300) }); }
      page.off('pageerror', onError);
    }
    await context.close();
  }

  const mobileContext = await contextFor(390, true);
  const mobile = await mobileContext.newPage();
  await mobile.goto(base.origin + '/dsg/history', { waitUntil: 'networkidle' });
  const menu = mobile.getByRole('button', { name: 'เปิดเมนู', exact: true });
  await menu.click();
  check('Mobile dialog opens with focus inside', await mobile.evaluate(() => document.querySelector('dialog')?.open && document.querySelector('dialog').contains(document.activeElement)));
  await mobile.keyboard.press('Escape');
  check('Escape returns focus to menu button', await menu.evaluate(node => node === document.activeElement));
  await mobile.evaluate(() => { window.__DSG_LOCAL_UI_NAVIGATION = 'fixture'; });
  await menu.click();
  await mobile.getByRole('dialog').getByRole('link', { name: 'เทมเพลต', exact: true }).click();
  await mobile.waitForURL(base.origin + '/dsg/templates');
  check('Mobile menu click reaches requested page without reloading SDK memory', await mobile.evaluate(() => window.__DSG_LOCAL_UI_NAVIGATION === 'fixture' && !document.querySelector('dialog')?.open));
  await mobile.goto(base.origin + '/dsg/workroom?tool=browser', { waitUntil: 'networkidle' });
  check('Browser deep link reveals requested tools after hydration', await mobile.locator('#dsg-advanced-tools').evaluate(node => node.open));
  check('Browser deep link selects Browser Controls', await mobile.locator('#workroom-tab-browser').getAttribute('aria-selected') === 'true');

  await mobile.goto(base.origin + '/dsg/history', { waitUntil: 'networkidle' });
  check('Real-data panel precedes optional demo history', await mobile.locator('.dsg-example-panel').evaluate(node => !node.open));
  await mobile.getByLabel('ค้นหางาน', { exact: true }).fill('Alpha');
  check('Search filters the actual loaded records', await mobile.getByRole('heading', { name: 'UI fixture · Alpha', exact: true }).count() === 1 && await mobile.getByRole('button', { name: 'ดูผลและหลักฐาน', exact: true }).count() === 1);
  await mobile.getByRole('button', { name: 'ดูผลและหลักฐาน', exact: true }).click();
  check('Result action reads the existing job endpoint', await mobile.getByRole('region', { name: 'ผลและหลักฐานจาก Backend', exact: true }).isVisible());
  readMode = 'failed';
  await mobile.getByRole('button', { name: 'รีเฟรชรายการ', exact: true }).click();
  const activity = mobile.getByRole('region', { name: 'ประวัติงานและผลลัพธ์', exact: true });
  await activity.getByRole('alert').waitFor();
  check('Read failure is explicit and retains labelled prior data', (await activity.getByRole('alert').innerText()).includes('ครั้งก่อน'));
  readMode = 'malformed';
  await mobile.getByRole('button', { name: 'รีเฟรชรายการ', exact: true }).click();
  await mobile.getByText('ข้อมูลรายการงานไม่ครบ', { exact: false }).waitFor();
  check('Malformed data never becomes an empty success state', await mobile.getByRole('heading', { name: 'ยังไม่มีงานในพื้นที่นี้', exact: true }).count() === 0);
  readMode = 'empty';
  await mobile.getByLabel('ค้นหางาน', { exact: true }).fill('');
  await mobile.getByRole('button', { name: 'รีเฟรชรายการ', exact: true }).click();
  await mobile.getByRole('heading', { name: 'ยังไม่มีงานในพื้นที่นี้', exact: true }).waitFor();
  check('Empty successful read has an actionable next step', await mobile.getByRole('link', { name: 'เปิดพื้นที่ทำงาน', exact: true }).isVisible());
  await mobileContext.close();

  const coarseContext = await contextFor(1280, true);
  const coarsePage = await coarseContext.newPage();
  await coarsePage.goto(base.origin + '/dsg/history', { waitUntil: 'networkidle' });
  check('Wide touch viewport keeps mobile navigation usable', await coarsePage.getByRole('button', { name: 'เปิดเมนู', exact: true }).isVisible() && !await coarsePage.locator('.dsg-desktop-navigation').isVisible());
  await coarseContext.close();
} catch (error) {
  check('UI regression run completes', false, { error: String(error).slice(0, 400) });
} finally {
  await browser.close();
  const receipt = { schema: 'dsg-local-rendered-ui-check/v1', scope: 'Local Next build with explicit UI-only API fixtures; no production/provider acceptance', routes, viewports: [320, 390, 1440], packages: { playwright: requireTools('playwright/package.json').version, axe: requireTools('axe-core/package.json').version }, checks: checks.length, passed: checks.filter(check => check.pass).length, failed: issues.length, issues, requests };
  await fs.writeFile(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({ checks: receipt.checks, passed: receipt.passed, failed: receipt.failed, output }));
  if (issues.length) { console.log(JSON.stringify(issues, null, 2)); process.exitCode = 1; }
}
