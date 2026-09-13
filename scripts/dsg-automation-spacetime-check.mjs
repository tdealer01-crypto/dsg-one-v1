import { readFileSync } from 'node:fs';

const req = readFileSync('automation_spacetime/requirements.txt', 'utf8').trim();
if (req !== 'agent-framework==1.18.0') throw new Error('AUTOMATION_FRAMEWORK_VERSION_NOT_PINNED');

const migration = readFileSync('supabase/migrations/202609130001_create_dsg_automation_spacetime.sql', 'utf8');
const policyMigration = readFileSync('supabase/migrations/20260913111308_harden_dsg_automation_spacetime_policies.sql', 'utf8');
for (const marker of [
  'dsg_automation_runs',
  'dsg_automation_steps',
  'dsg_automation_checkpoints',
  'dsg_automation_handoffs',
  'dsg_automation_timers',
  'dsg_automation_leases',
  'dsg_start_automation_run',
  'dsg_automation_save_checkpoint',
  'dsg_automation_transition_step',
  'dsg_automation_acquire_lease',
  'AUTOMATION_ACTIVE_RUN_CONFLICT',
  'AUTOMATION_DEPENDENCY_NOT_COMPLETED',
  'AUTOMATION_RETRY_LIMIT_REACHED',
  'from public, anon, authenticated',
  'to service_role',
  'task_plan_id uuid not null references public.dsg_task_plans',
  'wave_plan_id uuid not null references public.dsg_wave_plans',
  'AUTOMATION_ENGINE_VERSION_MISMATCH',
  'security definer',
  'grant execute on function public.dsg_start_automation_run',
  'enable row level security',
]) {
  if (!migration.includes(marker)) throw new Error(`AUTOMATION_SQL_CONTRACT_MISSING:${marker}`);
}

const dockerfile = readFileSync('Dockerfile', 'utf8');
for (const marker of [
  '/opt/dsg-automation',
  'automation_spacetime/requirements.txt',
  'DSG_AUTOMATION_ENGINE_VERSION=1.18.0',
  'dsg-one-container-entrypoint',
]) {
  if (!dockerfile.includes(marker)) throw new Error(`AUTOMATION_AZURE_IMAGE_CONTRACT_MISSING:${marker}`);
}

const route = readFileSync('app/api/dsg/jobs/[jobId]/automation/route.ts', 'utf8');
if (!route.includes("executionAuthority: 'none'")) throw new Error('AUTOMATION_AUTHORITY_BOUNDARY_MISSING');
if (!route.includes('governanceRequired: true')) throw new Error('AUTOMATION_GOVERNANCE_HANDOFF_MISSING');

const engine = readFileSync('automation_spacetime/engine.py', 'utf8');
if (!engine.includes('name=f"dsg-automation:{run_id}"')) throw new Error('AUTOMATION_WORKFLOW_NAME_NOT_DETERMINISTIC');
if (!migration.includes('p_previous_checkpoint_id is not null')) throw new Error('AUTOMATION_CHECKPOINT_NEW_ROOT_RULE_MISSING');
if ((policyMigration.match(/create policy dsg_automation_read/g) ?? []).length !== 6) throw new Error('AUTOMATION_READ_POLICIES_INCOMPLETE');
if (!policyMigration.includes("public.dsg_has_permission(workspace_id, 'job:read')")) throw new Error('AUTOMATION_READ_POLICY_SCOPE_MISSING');

const deployWorkflow = readFileSync('.github/workflows/deploy-dsg-one-production.yml', 'utf8');
if (!deployWorkflow.includes('DSG_ONE_V1_SUPABASE_URL=$SERVER_SUPABASE_URL')) throw new Error('AUTOMATION_SERVER_SUPABASE_BINDING_MISSING');
if (!readFileSync('lib/dsg/server/automation-spacetime.ts', 'utf8').includes('AUTOMATION_BOUND_PLAN_GRAPH_MISMATCH')) throw new Error('AUTOMATION_PLAN_GRAPH_REBIND_GUARD_MISSING');

if (!engine.includes('"execution_authority": "proposal-only"')) throw new Error('AUTOMATION_ENGINE_AUTHORITY_BOUNDARY_MISSING');
if (!engine.includes('"governance_authority": "dsg-spacetime"')) throw new Error('AUTOMATION_ENGINE_GOVERNANCE_BOUNDARY_MISSING');

console.log('AUTOMATION_SPACETIME_CONTRACT=PASS');
