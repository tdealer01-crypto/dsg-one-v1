-- DSG App Builder Step 16C
-- DB-backed runtime gate snapshot.
-- The UI must not provide gate state. Server routes derive and evaluate the gate from DB-backed job state plus server runtime environment.

create table if not exists dsg_app_builder_runtime_gate_snapshots (
  id uuid primary key default gen_random_uuid(),
  app_builder_job_id uuid not null unique references dsg_app_builder_jobs(id) on delete cascade,
  workspace_id text not null,

  plan_hash text not null,
  approval_hash text not null,
  approval_status text not null default 'PENDING' check (approval_status in ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED')),
  approval_signature_valid boolean not null default false,
  approval_approved_by text,
  approval_approved_at timestamptz,

  required_secrets jsonb not null default '[]'::jsonb,
  present_secrets jsonb not null default '[]'::jsonb,
  missing_secrets jsonb not null default '[]'::jsonb,

  allowed_tools jsonb not null default '[]'::jsonb,
  allowed_paths jsonb not null default '[]'::jsonb,
  allowed_commands jsonb not null default '[]'::jsonb,

  handoff_hash text not null,
  handoff_valid boolean not null default false,

  executor_env_ready boolean not null default false,
  executor_github_ready boolean not null default false,
  executor_branch_ready boolean not null default false,

  proof_required_refs jsonb not null default '[]'::jsonb,
  proof_present_refs jsonb not null default '[]'::jsonb,
  proof_complete boolean not null default false,

  last_gate_status text check (last_gate_status in ('READY', 'BLOCKED')),
  last_gate_hash text,
  last_failure_reasons jsonb not null default '[]'::jsonb,
  last_evaluated_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dsg_app_builder_runtime_gate_snapshots_job_idx
  on dsg_app_builder_runtime_gate_snapshots(app_builder_job_id);

create index if not exists dsg_app_builder_runtime_gate_snapshots_workspace_idx
  on dsg_app_builder_runtime_gate_snapshots(workspace_id);

create index if not exists dsg_app_builder_runtime_gate_snapshots_ready_idx
  on dsg_app_builder_runtime_gate_snapshots(last_gate_status)
  where last_gate_status = 'READY';

alter table dsg_app_builder_runtime_gate_snapshots enable row level security;

create or replace function dsg_app_builder_runtime_gate_snapshots_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists dsg_app_builder_runtime_gate_snapshots_updated_at
  on dsg_app_builder_runtime_gate_snapshots;

create trigger dsg_app_builder_runtime_gate_snapshots_updated_at
  before update on dsg_app_builder_runtime_gate_snapshots
  for each row execute function dsg_app_builder_runtime_gate_snapshots_set_updated_at();
