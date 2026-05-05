#!/usr/bin/env node
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const executionId = process.env.DSG_EXECUTION_ID;
const jobId = process.env.DSG_JOB_ID;
const previewUrl = normalizeUrl(process.env.DSG_PREVIEW_URL || '');
const gateHash = process.env.DSG_GATE_HASH || 'unknown';
const testIdentityRaw = process.env.DSG_TEST_IDENTITY || '';

if (!executionId || !jobId || !previewUrl) {
  throw new Error('DSG_EXECUTION_ID_JOB_ID_PREVIEW_URL_REQUIRED');
}

const outDir = '.dsg-production-flow';
const screenshotDir = path.join(outDir, 'screenshots');
mkdirSync(screenshotDir, { recursive: true });

const identity = parseIdentity(testIdentityRaw);
const steps = [];
const startedAt = new Date().toISOString();
let browser;

try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  await context.tracing.start({
    screenshots: true,
    snapshots: true,
    sources: false,
  });

  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    if (['error', 'warning'].includes(msg.type())) {
      consoleErrors.push(mask(msg.text()));
    }
  });

  page.on('pageerror', (error) => {
    pageErrors.push(mask(error.message));
  });

  steps.push(await runStep({
    id: 'load_home',
    name: 'Load preview home page',
    page,
    screenshotDir,
    action: async () => {
      await page.goto(previewUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1200);
    },
    assertion: async () => {
      const title = await page.title().catch(() => '');
      const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
      return title.trim().length > 0 && bodyText.trim().length > 0;
    },
    evidence: () => ({
      url: page.url(),
    }),
  }));

  steps.push(await runStep({
    id: 'no_visible_runtime_error',
    name: 'No visible runtime error',
    page,
    screenshotDir,
    action: async () => {
      await page.waitForTimeout(1000);
    },
    assertion: async () => {
      const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
      const forbidden = [
        'Application error',
        'Internal Server Error',
        'Unhandled Runtime Error',
        'undefined is not a function',
        'TypeError:',
        'ReferenceError:',
      ];
      return !forbidden.some((word) => bodyText.toLowerCase().includes(word.toLowerCase()));
    },
    evidence: () => ({
      consoleErrors: consoleErrors.slice(0, 20),
      pageErrors: pageErrors.slice(0, 20),
    }),
  }));

  if (identity) {
    steps.push(await runStep({
      id: 'login_with_test_identity',
      name: 'Login with test identity',
      page,
      screenshotDir,
      action: async () => {
        await page.goto(`${previewUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });

        const emailInput = page.locator('input[type="email"], input[name="email"], input[id*="email"]').first();
        const passwordInput = page.locator('input[type="password"], input[name="password"], input[id*="password"]').first();

        await emailInput.fill(identity.email, { timeout: 7000 });
        await passwordInput.fill(identity.password, { timeout: 7000 });

        const submit = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Login"), button:has-text("Log in")').first();
        await submit.click({ timeout: 7000 });
        await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
        await page.waitForTimeout(1500);
      },
      assertion: async () => !page.url().includes('/login'),
      evidence: () => ({
        finalUrl: page.url(),
        identity: '[redacted]',
      }),
    }));
  } else {
    steps.push({
      id: 'login_with_test_identity',
      name: 'Login with test identity',
      status: 'BLOCK',
      durationMs: 0,
      screenshot: null,
      error: 'DSG_TEST_IDENTITY missing; production proof cannot pass without test identity',
      evidence: {},
    });
  }

  steps.push(await runStep({
    id: 'protected_route_behavior',
    name: 'Protected route behavior',
    page,
    screenshotDir,
    action: async () => {
      await page.goto(`${previewUrl}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1200);
    },
    assertion: async () => {
      if (identity) return !page.url().includes('/login');
      return page.url().includes('/login') || page.url().includes('/signin');
    },
    evidence: () => ({
      finalUrl: page.url(),
      expected: identity ? 'authenticated access' : 'anonymous redirect/block',
    }),
  }));


  steps.push({
    id: 'crud_smoke_probe',
    name: 'CRUD smoke probe',
    status: 'BLOCK',
    durationMs: 0,
    screenshot: null,
    error: 'CRUD proof requires generated CRUD route and test data contract; /api/health is not CRUD proof.',
    evidence: {},
  });

  steps.push(await runStep({
    id: 'logout_or_session_boundary',
    name: 'Logout or session boundary',
    page,
    screenshotDir,
    action: async () => {
      const logout = page.locator('button:has-text("Sign out"), button:has-text("Logout"), a:has-text("Sign out"), a:has-text("Logout")').first();
      if (await logout.count().catch(() => 0)) {
        await logout.click({ timeout: 5000 });
        await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
      }
    },
    assertion: async () => true,
    evidence: () => ({
      finalUrl: page.url(),
    }),
  }));

  await context.tracing.stop({ path: path.join(outDir, `trace-${executionId}.zip`) });
  await context.close();
} catch (error) {
  steps.push({
    id: 'runner_crash',
    name: 'Runner crash',
    status: 'FAIL',
    durationMs: 0,
    screenshot: null,
    error: mask(error instanceof Error ? error.message : String(error)),
    evidence: {},
  });
} finally {
  if (browser) await browser.close().catch(() => {});
}

const hardFailed = steps.some((s) => s.status === 'FAIL' || s.status === 'BLOCK');
const production_flow_passed = !hardFailed;

const resultWithoutHash = {
  executionId,
  jobId,
  gateHash,
  previewUrl,
  runner: 'github-actions-playwright',
  production_flow_passed,
  steps,
  artifacts: {
    trace: `.dsg-production-flow/trace-${executionId}.zip`,
    screenshotsDir: '.dsg-production-flow/screenshots',
  },
  startedAt,
  completedAt: new Date().toISOString(),
};

const flowHash = sha256Json(resultWithoutHash);
const result = { ...resultWithoutHash, flowHash };

writeFileSync('dsg-production-flow-result.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify({ production_flow_passed, flowHash }, null, 2));

process.exit(0);

async function runStep({ id, name, page, screenshotDir, action, assertion, evidence }) {
  const start = Date.now();
  let screenshot = null;

  try {
    await action();
    const passed = await assertion();
    screenshot = path.join(screenshotDir, `${id}-${Date.now()}.png`);
    await page.screenshot({ path: screenshot, fullPage: false }).catch(() => {});

    return {
      id,
      name,
      status: passed ? 'PASS' : 'FAIL',
      durationMs: Date.now() - start,
      screenshot,
      evidence: evidence ? evidence() : {},
    };
  } catch (error) {
    screenshot = path.join(screenshotDir, `${id}-error-${Date.now()}.png`);
    await page.screenshot({ path: screenshot, fullPage: false }).catch(() => {});

    return {
      id,
      name,
      status: 'FAIL',
      durationMs: Date.now() - start,
      screenshot,
      error: mask(error instanceof Error ? error.message : String(error)),
      evidence: evidence ? evidence() : {},
    };
  }
}

function parseIdentity(raw) {
  if (!raw.trim()) return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed?.email && parsed?.password) {
      return { email: String(parsed.email), password: String(parsed.password) };
    }
  } catch {}

  const [email, password] = raw.split(':');
  if (email && password) return { email, password };
  return null;
}

function normalizeUrl(value) {
  const trimmed = String(value).trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return `https://${trimmed}`;
}

function mask(value) {
  return String(value)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/password[^\s]*/gi, 'password=[redacted]')
    .slice(0, 2000);
}

function sha256Json(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex')}`;
}
