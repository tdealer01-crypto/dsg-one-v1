#!/usr/bin/env node

const fs = await import('node:fs/promises');

const requiredFiles = [
  'lib/dsg/autonomous-level/capability-gate.ts',
  'app/api/dsg/autonomous-level/status/route.ts',
  'app/dsg/autonomous-level/page.tsx',
];

for (const file of requiredFiles) {
  await fs.access(file);
}

const gate = await fs.readFile('lib/dsg/autonomous-level/capability-gate.ts', 'utf8');
const page = await fs.readFile('app/dsg/autonomous-level/page.tsx', 'utf8');
const route = await fs.readFile('app/api/dsg/autonomous-level/status/route.ts', 'utf8');
const all = `${gate}\n${page}\n${route}`;

if (!gate.includes('DSG_AUTONOMOUS_LEVEL_COMPLETE')) throw new Error('gate must define DSG complete claim');
if (!gate.includes('DSG_AUTONOMOUS_LEVEL_PARTIAL')) throw new Error('gate must define DSG partial claim');
if (!gate.includes('sandbox_isolation')) throw new Error('gate must include sandbox isolation capability');
if (!gate.includes('remote_browser_session')) throw new Error('gate must include remote browser capability');
if (!gate.includes("status('sandbox_isolation', 'BLOCKED')")) throw new Error('sandbox must default to blocked');
if (!gate.includes("status('remote_browser_session', 'BLOCKED')")) throw new Error('remote browser must default to blocked');
if (!page.includes('gate.claim')) throw new Error('page must render gate.claim');
if (!page.includes('gate.complete ?')) throw new Error('page must render completion boundary');
if (!route.includes('evaluateDsgAutonomousLevelGate')) throw new Error('API route must use DSG gate evaluator');
if (/manus/i.test(all)) throw new Error('DSG autonomous level files must not reference external platform names');

console.log('PASS: DSG autonomous level gate smoke checks passed');
