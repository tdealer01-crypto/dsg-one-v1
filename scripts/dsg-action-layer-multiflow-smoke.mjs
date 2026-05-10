#!/usr/bin/env node

const fs = await import('node:fs/promises');

const requiredFiles = [
  'lib/dsg/action-layer/types.ts',
  'lib/dsg/action-layer/action-contract.ts',
  'lib/dsg/action-layer/action-router.ts',
  'lib/dsg/action-layer/multi-flow-orchestrator.ts',
  'app/api/dsg/action-layer/route.ts',
  'app/api/dsg/action-layer/status/route.ts',
  'app/api/dsg/action-layer/timeline/route.ts',
  'app/dsg/action-layer/page.tsx',
];

for (const file of requiredFiles) {
  await fs.access(file);
}

const types = await fs.readFile('lib/dsg/action-layer/types.ts', 'utf8');
const contract = await fs.readFile('lib/dsg/action-layer/action-contract.ts', 'utf8');
const router = await fs.readFile('lib/dsg/action-layer/action-router.ts', 'utf8');
const orchestrator = await fs.readFile('lib/dsg/action-layer/multi-flow-orchestrator.ts', 'utf8');
const page = await fs.readFile('app/dsg/action-layer/page.tsx', 'utf8');
const api = await fs.readFile('app/api/dsg/action-layer/route.ts', 'utf8');
const status = await fs.readFile('app/api/dsg/action-layer/status/route.ts', 'utf8');
const timeline = await fs.readFile('app/api/dsg/action-layer/timeline/route.ts', 'utf8');
const all = `${types}\n${contract}\n${router}\n${orchestrator}\n${page}\n${api}\n${status}\n${timeline}`;

const requiredTerms = [
  'DsgActionFlow',
  'DsgActionContract',
  'createDsgActionContract',
  'routeDsgAction',
  'executeDsgAction',
  'getDsgActionLayerSnapshot',
  'DSG_ACTION_LAYER_COMPLETE',
  'Command Center',
  'Live Reasoning',
  'Governance Vault',
  'Telemetry',
  'Final Approval',
  '/api/dsg/action-layer',
];

for (const term of requiredTerms) {
  if (!all.includes(term)) throw new Error(`missing ${term}`);
}

if (/manus/i.test(all)) throw new Error('action layer must not reference external platform names');
if (!page.includes('DSG GOVERNANCE')) throw new Error('page must render DSG governance shell');
if (!page.includes('Live Execution Capacity')) throw new Error('page must render live execution capacity');
if (!page.includes('Assign Enterprise Task')) throw new Error('page must render command input section');
if (!orchestrator.includes('command_center')) throw new Error('orchestrator must include command center flow');
if (!orchestrator.includes('proof_timeline')) throw new Error('orchestrator must include proof timeline flow');

console.log('PASS: DSG action layer deterministic multi-flow smoke checks passed');
