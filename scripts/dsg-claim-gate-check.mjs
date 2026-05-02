import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const requiredFiles = [
  '.dsg/WORK_LEDGER.md',
  'docs/AGI_DSG_RUNTIME_BUILD_PLAN.md',
  'docs/AGI_DSG_RUNTIME_ROUTE_MAP.md',
  'docs/AGI_DSG_OPERATOR_RUNBOOK.md',
  'formal/dsg-claim-gate-invariants.smt2',
  'lib/dsg/runtime/claim-gate.ts',
  'app/agi/page.tsx',
];

const missing = requiredFiles.filter((file) => !existsSync(join(root, file)));
if (missing.length > 0) {
  console.error('DSG claim gate failed: missing files');
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

const ledger = readFileSync(join(root, '.dsg/WORK_LEDGER.md'), 'utf8');
const requiredPhrases = [
  'PRODUCTION: no',
  'DEPLOYABLE: no',
  'VERIFIED: no',
  'No production claim without evidence',
];

const phraseMissing = requiredPhrases.filter((phrase) => !ledger.includes(phrase));
if (phraseMissing.length > 0) {
  console.error('DSG claim gate failed: ledger is missing truthful claim markers');
  for (const phrase of phraseMissing) console.error(`- ${phrase}`);
  process.exit(1);
}

console.log('DSG claim gate passed: guard files exist and production claim remains blocked.');
