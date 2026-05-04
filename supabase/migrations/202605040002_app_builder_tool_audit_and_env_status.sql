-- DSG App Builder Step 17
-- Adds DB-backed audit for app-builder tool calls and extends runtime status vocabulary.

create table if not exists dsg_app_builder_tool_audits (
  id uuid primary key default gen_random_uuid(),
  app_builder_job_id uuid not null references dsg_app_builder_jobs(id) on delete cascade,
  workspace_id uuid not null,
  actor_id text not null,
  tool_name text not null,
  outcome text not null,
  evidence_refs jsonb not null default '[]'::jsonb,
  audit_event jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists dsg_app_builder_tool_audits_job_created_idx
  on dsg_app_builder_tool_audits(app_builder_job_id, created_at desc);

alter table if exists dsg_app_builder_jobs
  drop constraint if exists dsg_app_builder_jobs_status_check;

alter table if exists dsg_app_builder_jobs
  add constraint dsg_app_builder_jobs_status_check
  check (status in (
    'DRAFT',
    'GOAL_LOCKED',
    'PRD_READY',
    'PLAN_READY',
    'WAITING_APPROVAL',
    'APPROVED',
    'READY_FOR_RUNTIME',
    'ENVIRONMENT_READY',
    'EXECUTING',
    'PR_CREATED',
    'REJECTED',
    'BLOCKED',
    'FAILED',
    'COMPLETED'
  ));

alter table if exists dsg_app_builder_jobs
  drop constraint if exists dsg_app_builder_jobs_claim_status_check;

alter table if exists dsg_app_builder_jobs
  add constraint dsg_app_builder_jobs_claim_status_check
  check (claim_status in (
    'NOT_STARTED',
    'PLANNED_ONLY',
    'APPROVED_ONLY',
    'ENVIRONMENT_READY',
    'IMPLEMENTED_UNVERIFIED',
    'PREVIEW_READY',
    'DEPLOYABLE',
    'PRODUCTION_BLOCKED',
    'PRODUCTION_VERIFIED'
  ));
