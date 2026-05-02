import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const required = [
  'supabase/migrations/20260502174934_create_dsg_runtime_core_step_2.sql',
  'supabase/migrations/20260502175200_harden_dsg_runtime_functions_step_2.sql',
  'supabase/migrations/20260502181720_add_dsg_runtime_policies_and_rpc.sql',
  'supabase/migrations/20260502183649_add_dsg_plan_audit_completion_rpc.sql',
  'supabase/migrations/20260502184542_add_dsg_deployment_production_flow_rpc.sql',
  'lib/dsg/runtime/stable-json.ts',
  'lib/dsg/runtime/hash.ts',
  'lib/dsg/runtime/planner.ts',
  'lib/dsg/runtime/audit.ts',
  'lib/dsg/runtime/evidence.ts',
  'lib/dsg/runtime/replay.ts',
  'lib/dsg/runtime/completion.ts',
  'lib/dsg/runtime/no-mock-guard.ts',
  'lib/dsg/connectors/openapi.ts',
  'lib/dsg/server/context.ts',
  'lib/dsg/server/repository.ts',
  'lib/dsg/server/supabase-rpc.ts',
  'app/api/dsg/workspaces/route.ts',
  'app/api/dsg/jobs/route.ts',
  'app/api/dsg/jobs/[jobId]/plan/route.ts',
  'app/api/dsg/jobs/[jobId]/evidence/route.ts',
  'app/api/dsg/jobs/[jobId]/evidence/manifest/route.ts',
  'app/api/dsg/jobs/[jobId]/audit/export/route.ts',
  'app/api/dsg/jobs/[jobId]/replay/route.ts',
  'app/api/dsg/jobs/[jobId]/deployment-proof/route.ts',
  'app/api/dsg/jobs/[jobId]/production-flow-proof/route.ts',
  'app/api/dsg/jobs/[jobId]/completion/route.ts',
  'app/api/dsg/verify/route.ts',
  'docs/DSG_SUPABASE_BACKEND_WIRING.md',
];

const missing = required.filter((file) => !existsSync(join(root, file)));
if (missing.length) {
  console.error('DSG deterministic runtime check failed: missing files');
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

const apiRouteFiles = required.filter((file) => file.startsWith('app/api/dsg/') && file.endsWith('/route.ts'));
for (const file of apiRouteFiles) {
  const source = readFileSync(join(root, file), 'utf8');
  if (source.includes('devHeaderActor') || source.includes('x-dsg-actor-role')) {
    console.error(`DSG deterministic runtime check failed: route uses dev actor bridge ${file}`);
    process.exit(1);
  }
}

const migration = readFileSync(join(root, 'supabase/migrations/20260502174934_create_dsg_runtime_core_step_2.sql'), 'utf8');
const tables = [
  'dsg_runtime_jobs',
  'dsg_task_plans',
  'dsg_wave_plans',
  'dsg_evidence_items',
  'dsg_audit_ledger',
  'dsg_replay_proofs',
  'dsg_completion_reports',
  'dsg_deployment_proofs',
  'dsg_production_flow_proofs',
];

for (const table of tables) {
  if (!migration.includes(table)) {
    console.error(`DSG deterministic runtime check failed: migration missing ${table}`);
    process.exit(1);
  }
}

const rpcSource = readFileSync(join(root, 'supabase/migrations/20260502181720_add_dsg_runtime_policies_and_rpc.sql'), 'utf8');
const rpcNames = ['dsg_create_workspace', 'dsg_create_runtime_job', 'dsg_record_evidence', 'dsg_record_replay_proof'];
for (const rpcName of rpcNames) {
  if (!rpcSource.includes(rpcName)) {
    console.error(`DSG deterministic runtime check failed: migration missing ${rpcName}`);
    process.exit(1);
  }
}

const completionRpcSource = readFileSync(join(root, 'supabase/migrations/20260502183649_add_dsg_plan_audit_completion_rpc.sql'), 'utf8');
const completionRpcNames = ['dsg_create_plan', 'dsg_create_evidence_manifest', 'dsg_create_audit_export', 'dsg_create_completion_report'];
for (const rpcName of completionRpcNames) {
  if (!completionRpcSource.includes(rpcName)) {
    console.error(`DSG deterministic runtime check failed: migration missing ${rpcName}`);
    process.exit(1);
  }
}

const deploymentRpcSource = readFileSync(join(root, 'supabase/migrations/20260502184542_add_dsg_deployment_production_flow_rpc.sql'), 'utf8');
const deploymentRpcNames = ['dsg_record_deployment_proof', 'dsg_record_production_flow_proof'];
for (const rpcName of deploymentRpcNames) {
  if (!deploymentRpcSource.includes(rpcName)) {
    console.error(`DSG deterministic runtime check failed: migration missing ${rpcName}`);
    process.exit(1);
  }
}

const combined = required.map((file) => readFileSync(join(root, file), 'utf8')).join('\n---DSG---\n');
const digest = createHash('sha256').update(combined, 'utf8').digest('hex');
console.log(`DSG deterministic runtime check passed sha256:${digest}`);
