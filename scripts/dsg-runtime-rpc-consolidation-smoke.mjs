#!/usr/bin/env node

const fs = await import('node:fs/promises');

const requiredFiles = [
  'docs/DSG_RUNTIME_RPC_CONSOLIDATION.md',
  '.github/workflows/dsg-verify.yml',
  'lib/dsg/server/context.ts',
  'lib/dsg/server/repository.ts',
  'lib/dsg/server/supabase-rpc.ts',
  'app/api/dsg/jobs/route.ts',
  'app/api/dsg/jobs/[jobId]/evidence/route.ts',
  'app/api/dsg/jobs/[jobId]/completion/route.ts',
  'app/api/dsg/jobs/[jobId]/deployment-proof/route.ts',
  'app/api/dsg/jobs/[jobId]/production-flow-proof/route.ts',
  'app/api/dsg/workspaces/route.ts',
];

for (const file of requiredFiles) {
  await fs.access(file);
}

const repository = await fs.readFile('lib/dsg/server/repository.ts', 'utf8');
const context = await fs.readFile('lib/dsg/server/context.ts', 'utf8');
const workflow = await fs.readFile('.github/workflows/dsg-verify.yml', 'utf8');
const report = await fs.readFile('docs/DSG_RUNTIME_RPC_CONSOLIDATION.md', 'utf8');

const requiredRepositoryTerms = [
  'createRuntimeJob',
  'createRuntimePlan',
  'writeEvidence',
  'createEvidenceManifest',
  'recordReplayProof',
  'recordDeploymentProof',
  'recordProductionFlowProof',
  'createCompletionReport',
  'getRuntimeJobTimeline',
];

for (const term of requiredRepositoryTerms) {
  if (!repository.includes(term)) throw new Error(`repository missing ${term}`);
}

if (!context.includes('requireVerifiedDsgActor')) throw new Error('context missing requireVerifiedDsgActor');
if (!workflow.includes('npm run dsg:typecheck')) throw new Error('workflow missing typecheck');
if (!workflow.includes('npm run lint')) throw new Error('workflow missing lint');
if (!report.includes('Do not merge old preview branches directly')) throw new Error('report missing blind merge boundary');
if (/manus/i.test(report)) throw new Error('report must not reference external platform product naming');

console.log('PASS: DSG runtime RPC consolidation smoke checks passed');
