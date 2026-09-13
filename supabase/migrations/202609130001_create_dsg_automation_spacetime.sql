create table if not exists public.dsg_automation_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.dsg_runtime_jobs(id) on delete cascade,
  workspace_id uuid not null references public.dsg_workspaces(id) on delete cascade,
  task_plan_id uuid not null references public.dsg_task_plans(id) on delete restrict,
  wave_plan_id uuid not null references public.dsg_wave_plans(id) on delete restrict,
  plan_hash text not null,
  wave_hash text not null,
  engine text not null default 'microsoft-agent-framework',
  engine_version text not null default '1.18.0',
  workflow_name text not null,
  framework_workflow_name text,
  plan_graph_hash text not null,
  framework_graph_signature_hash text,
  status text not null default 'CREATED' check (status in (
    'CREATED','RUNNING','WAITING','RETRYING','PAUSED','VERIFYING','COMPLETED','BLOCKED','FAILED','KILLED'
  )),
  current_checkpoint_id text,
  current_iteration integer not null default 0 check (current_iteration >= 0),
  retry_count integer not null default 0 check (retry_count >= 0),
  max_retries integer not null default 3 check (max_retries between 0 and 20),
  next_run_at timestamptz,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.dsg_automation_steps (
  run_id uuid not null references public.dsg_automation_runs(id) on delete cascade,
  job_id uuid not null references public.dsg_runtime_jobs(id) on delete cascade,
  workspace_id uuid not null references public.dsg_workspaces(id) on delete cascade,
  task_id text not null,
  dependencies jsonb not null default '[]'::jsonb,
  status text not null default 'PENDING' check (status in (
    'PENDING','READY','RUNNING','WAITING','RETRYING','COMPLETED','BLOCKED','FAILED','KILLED'
  )),
  attempt integer not null default 0 check (attempt >= 0),
  assigned_agent text,
  next_run_at timestamptz,
  result_ref text,
  updated_at timestamptz not null default now(),
  primary key (run_id, task_id)
);

create table if not exists public.dsg_automation_checkpoints (
  checkpoint_id text primary key,
  run_id uuid not null references public.dsg_automation_runs(id) on delete cascade,
  job_id uuid not null references public.dsg_runtime_jobs(id) on delete cascade,
  workspace_id uuid not null references public.dsg_workspaces(id) on delete cascade,
  workflow_name text not null,
  framework_graph_signature_hash text not null,
  previous_checkpoint_id text,
  iteration_count integer not null check (iteration_count >= 0),
  encoded_checkpoint jsonb not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (run_id, checkpoint_id)
);

create table if not exists public.dsg_automation_handoffs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.dsg_automation_runs(id) on delete cascade,
  job_id uuid not null references public.dsg_runtime_jobs(id) on delete cascade,
  workspace_id uuid not null references public.dsg_workspaces(id) on delete cascade,
  from_agent text not null,
  to_agent text not null,
  reason text not null,
  status text not null default 'PENDING' check (status in ('PENDING','ACCEPTED','REJECTED','COMPLETED')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.dsg_automation_timers (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.dsg_automation_runs(id) on delete cascade,
  job_id uuid not null references public.dsg_runtime_jobs(id) on delete cascade,
  workspace_id uuid not null references public.dsg_workspaces(id) on delete cascade,
  timer_key text not null,
  wake_at timestamptz not null,
  status text not null default 'PENDING' check (status in ('PENDING','FIRED','CANCELLED')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (run_id, timer_key)
);

create table if not exists public.dsg_automation_leases (
  run_id uuid not null references public.dsg_automation_runs(id) on delete cascade,
  step_key text not null,
  job_id uuid not null references public.dsg_runtime_jobs(id) on delete cascade,
  workspace_id uuid not null references public.dsg_workspaces(id) on delete cascade,
  owner_id text not null,
  lease_token uuid not null default gen_random_uuid(),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (run_id, step_key)
);

create index if not exists idx_dsg_automation_runs_job on public.dsg_automation_runs(job_id, created_at desc);
create unique index if not exists uq_dsg_automation_active_run_per_job on public.dsg_automation_runs(job_id)
where status in ('CREATED','RUNNING','WAITING','RETRYING','PAUSED','VERIFYING');
create index if not exists idx_dsg_automation_steps_ready on public.dsg_automation_steps(run_id, status, next_run_at);
create index if not exists idx_dsg_automation_checkpoints_run on public.dsg_automation_checkpoints(run_id, created_at desc);
create index if not exists idx_dsg_automation_handoffs_run on public.dsg_automation_handoffs(run_id, created_at desc);
create index if not exists idx_dsg_automation_timers_due on public.dsg_automation_timers(status, wake_at);
create index if not exists idx_dsg_automation_leases_expiry on public.dsg_automation_leases(expires_at);

alter table public.dsg_automation_runs enable row level security;
alter table public.dsg_automation_steps enable row level security;
alter table public.dsg_automation_checkpoints enable row level security;
alter table public.dsg_automation_handoffs enable row level security;
alter table public.dsg_automation_timers enable row level security;
alter table public.dsg_automation_leases enable row level security;

create or replace function public.dsg_start_automation_run(
  p_job_id uuid,
  p_task_plan_id uuid,
  p_wave_plan_id uuid,
  p_workflow_name text,
  p_plan_graph_hash text,
  p_engine_version text default '1.18.0',
  p_max_retries integer default 3
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor text := public.dsg_current_actor_id();
  v_workspace_id uuid;
  v_run_id uuid;
  v_existing public.dsg_automation_runs%rowtype;
  v_tasks jsonb;
  v_plan_hash text;
  v_wave_hash text;
begin
  select workspace_id into v_workspace_id from public.dsg_runtime_jobs where id = p_job_id;
  if v_workspace_id is null then raise exception 'DSG_JOB_NOT_FOUND'; end if;
  if v_actor is null then raise exception 'DSG_AUTH_REQUIRED'; end if;
  if not public.dsg_has_permission(v_workspace_id, 'job:control') then raise exception 'DSG_PERMISSION_DENIED'; end if;
  if nullif(trim(p_workflow_name), '') is null then raise exception 'AUTOMATION_WORKFLOW_NAME_REQUIRED'; end if;
  if p_plan_graph_hash !~ '^[0-9a-f]{64}$' then raise exception 'AUTOMATION_PLAN_GRAPH_HASH_INVALID'; end if;
  if p_engine_version <> '1.18.0' then raise exception 'AUTOMATION_ENGINE_VERSION_MISMATCH'; end if;
  if p_max_retries < 0 or p_max_retries > 20 then raise exception 'AUTOMATION_RETRY_LIMIT_INVALID'; end if;

  select plan_hash, tasks into v_plan_hash, v_tasks
  from public.dsg_task_plans
  where id = p_task_plan_id and job_id = p_job_id and workspace_id = v_workspace_id;
  if v_tasks is null or jsonb_array_length(v_tasks) = 0 then raise exception 'AUTOMATION_TASK_PLAN_MISMATCH'; end if;

  select wave_hash into v_wave_hash
  from public.dsg_wave_plans
  where id = p_wave_plan_id and task_plan_id = p_task_plan_id
    and job_id = p_job_id and workspace_id = v_workspace_id;
  if v_wave_hash is null then raise exception 'AUTOMATION_WAVE_PLAN_MISMATCH'; end if;

  select * into v_existing
  from public.dsg_automation_runs
  where job_id = p_job_id
    and status in ('CREATED','RUNNING','WAITING','RETRYING','PAUSED','VERIFYING')
  order by created_at desc
  limit 1
  for update;
  if v_existing.id is not null then
    if v_existing.workflow_name = p_workflow_name
       and v_existing.task_plan_id = p_task_plan_id
       and v_existing.wave_plan_id = p_wave_plan_id
       and v_existing.plan_graph_hash = p_plan_graph_hash
       and v_existing.engine_version = p_engine_version then
      return v_existing.id;
    end if;
    raise exception 'AUTOMATION_ACTIVE_RUN_CONFLICT';
  end if;

  insert into public.dsg_automation_runs(
    job_id, workspace_id, task_plan_id, wave_plan_id, plan_hash, wave_hash,
    workflow_name, plan_graph_hash, engine_version, max_retries, created_by
  ) values (
    p_job_id, v_workspace_id, p_task_plan_id, p_wave_plan_id, v_plan_hash, v_wave_hash,
    p_workflow_name, p_plan_graph_hash, p_engine_version, p_max_retries, v_actor
  ) returning id into v_run_id;

  insert into public.dsg_automation_steps(run_id, job_id, workspace_id, task_id, dependencies)
  select
    v_run_id, p_job_id, v_workspace_id, task->>'id',
    coalesce(task->'dependsOn', task->'depends_on', '[]'::jsonb)
  from jsonb_array_elements(v_tasks) task;

  insert into public.dsg_runtime_events(job_id, workspace_id, event_type, message, actor_id, payload)
  values (
    p_job_id, v_workspace_id, 'AUTOMATION_RUN_CREATED',
    'Automation Spacetime run created', v_actor,
    jsonb_build_object('automation_run_id', v_run_id, 'workflow_name', p_workflow_name, 'engine_version', p_engine_version, 'plan_graph_hash', p_plan_graph_hash, 'task_plan_id', p_task_plan_id, 'wave_plan_id', p_wave_plan_id, 'plan_hash', v_plan_hash, 'wave_hash', v_wave_hash)
  );

  return v_run_id;
end
$$;

create or replace function public.dsg_automation_save_checkpoint(
  p_run_id uuid,
  p_checkpoint_id text,
  p_previous_checkpoint_id text,
  p_workflow_name text,
  p_graph_signature_hash text,
  p_iteration_count integer,
  p_encoded_checkpoint jsonb,
  p_payload_hash text,
  p_created_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run public.dsg_automation_runs%rowtype;
  v_existing_hash text;
begin
  select * into v_run from public.dsg_automation_runs where id = p_run_id for update;
  if v_run.id is null then raise exception 'AUTOMATION_RUN_NOT_FOUND'; end if;
  if v_run.framework_workflow_name is not null and p_workflow_name <> v_run.framework_workflow_name then raise exception 'AUTOMATION_FRAMEWORK_WORKFLOW_MISMATCH'; end if;
  if v_run.framework_graph_signature_hash is not null and p_graph_signature_hash <> v_run.framework_graph_signature_hash then raise exception 'AUTOMATION_FRAMEWORK_GRAPH_MISMATCH'; end if;
  if p_payload_hash !~ '^[0-9a-f]{64}$' then raise exception 'AUTOMATION_CHECKPOINT_HASH_INVALID'; end if;
  if p_iteration_count < 0 then raise exception 'AUTOMATION_ITERATION_INVALID'; end if;

  select payload_hash into v_existing_hash
  from public.dsg_automation_checkpoints
  where checkpoint_id = p_checkpoint_id;
  if v_existing_hash is not null then
    if v_existing_hash <> p_payload_hash then raise exception 'AUTOMATION_CHECKPOINT_CONFLICT'; end if;
    return;
  end if;

  -- A fresh Core Spin evaluation is allowed to start a new checkpoint root.
  -- Resume/continuation checkpoints must extend the currently committed lineage.
  if p_previous_checkpoint_id is not null
     and v_run.current_checkpoint_id is distinct from p_previous_checkpoint_id then
    raise exception 'AUTOMATION_CHECKPOINT_LINEAGE_MISMATCH';
  end if;

  insert into public.dsg_automation_checkpoints(
    checkpoint_id, run_id, job_id, workspace_id, workflow_name,
    framework_graph_signature_hash, previous_checkpoint_id, iteration_count,
    encoded_checkpoint, payload_hash, created_at
  ) values (
    p_checkpoint_id, p_run_id, v_run.job_id, v_run.workspace_id, p_workflow_name,
    p_graph_signature_hash, p_previous_checkpoint_id, p_iteration_count,
    p_encoded_checkpoint, p_payload_hash, coalesce(p_created_at, now())
  );

  update public.dsg_automation_runs
  set framework_workflow_name = coalesce(framework_workflow_name, p_workflow_name),
      framework_graph_signature_hash = coalesce(framework_graph_signature_hash, p_graph_signature_hash),
      current_checkpoint_id = p_checkpoint_id,
      current_iteration = p_iteration_count,
      status = case when status = 'CREATED' then 'RUNNING' else status end,
      updated_at = now()
  where id = p_run_id;
end
$$;

revoke execute on function public.dsg_start_automation_run(uuid, uuid, uuid, text, text, text, integer) from public, anon;
grant execute on function public.dsg_start_automation_run(uuid, uuid, uuid, text, text, text, integer) to authenticated, service_role;
revoke execute on function public.dsg_automation_save_checkpoint(uuid, text, text, text, text, integer, jsonb, text, timestamptz) from public, anon, authenticated;
grant execute on function public.dsg_automation_save_checkpoint(uuid, text, text, text, text, integer, jsonb, text, timestamptz) to service_role;

create or replace function public.dsg_automation_transition_step(
  p_run_id uuid,
  p_task_id text,
  p_expected_status text,
  p_next_status text,
  p_assigned_agent text default null,
  p_result_ref text default null,
  p_next_run_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor text := public.dsg_current_actor_id();
  v_workspace_id uuid;
  v_current_status text;
  v_attempt integer;
  v_max_retries integer;
  v_dependencies jsonb;
begin
  select r.workspace_id into v_workspace_id from public.dsg_automation_runs r where r.id = p_run_id;
  if v_workspace_id is null then raise exception 'AUTOMATION_RUN_NOT_FOUND'; end if;
  if v_actor is null then raise exception 'DSG_AUTH_REQUIRED'; end if;
  if not public.dsg_has_permission(v_workspace_id, 'job:control') then raise exception 'DSG_PERMISSION_DENIED'; end if;

  select s.status, s.attempt, s.dependencies, r.max_retries
  into v_current_status, v_attempt, v_dependencies, v_max_retries
  from public.dsg_automation_steps s
  join public.dsg_automation_runs r on r.id = s.run_id
  where s.run_id = p_run_id and s.task_id = p_task_id
  for update of s;
  if v_current_status is null then raise exception 'AUTOMATION_STEP_NOT_FOUND'; end if;
  if v_current_status <> p_expected_status then raise exception 'AUTOMATION_STEP_STALE_STATE'; end if;

  if p_next_status = 'READY' and exists (
    select 1
    from jsonb_array_elements_text(coalesce(v_dependencies, '[]'::jsonb)) dep(task_id)
    where not exists (
      select 1 from public.dsg_automation_steps dependency_step
      where dependency_step.run_id = p_run_id
        and dependency_step.task_id = dep.task_id
        and dependency_step.status = 'COMPLETED'
    )
  ) then
    raise exception 'AUTOMATION_DEPENDENCY_NOT_COMPLETED';
  end if;

  if p_next_status = 'RETRYING' and v_attempt >= v_max_retries then
    raise exception 'AUTOMATION_RETRY_LIMIT_REACHED';
  end if;

  if not (
    (v_current_status = 'PENDING' and p_next_status in ('READY','BLOCKED','KILLED')) or
    (v_current_status = 'READY' and p_next_status in ('RUNNING','WAITING','BLOCKED','KILLED')) or
    (v_current_status = 'RUNNING' and p_next_status in ('COMPLETED','WAITING','RETRYING','BLOCKED','FAILED','KILLED')) or
    (v_current_status = 'WAITING' and p_next_status in ('READY','BLOCKED','KILLED')) or
    (v_current_status = 'RETRYING' and p_next_status in ('READY','FAILED','KILLED'))
  ) then
    raise exception 'AUTOMATION_STEP_TRANSITION_INVALID';
  end if;

  if p_next_status = 'RETRYING' then v_attempt := v_attempt + 1; end if;

  update public.dsg_automation_steps
  set status = p_next_status,
      attempt = v_attempt,
      assigned_agent = coalesce(p_assigned_agent, assigned_agent),
      result_ref = coalesce(p_result_ref, result_ref),
      next_run_at = p_next_run_at,
      updated_at = now()
  where run_id = p_run_id and task_id = p_task_id;

  update public.dsg_automation_runs set updated_at = now() where id = p_run_id;

  return jsonb_build_object('task_id', p_task_id, 'status', p_next_status, 'attempt', v_attempt);
end
$$;

create or replace function public.dsg_automation_acquire_lease(
  p_run_id uuid,
  p_step_key text,
  p_owner_id text,
  p_ttl_seconds integer default 60
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor text := public.dsg_current_actor_id();
  v_run public.dsg_automation_runs%rowtype;
  v_token uuid := gen_random_uuid();
begin
  if p_ttl_seconds < 1 or p_ttl_seconds > 3600 then raise exception 'AUTOMATION_LEASE_TTL_INVALID'; end if;
  if nullif(trim(p_step_key), '') is null or nullif(trim(p_owner_id), '') is null then raise exception 'AUTOMATION_LEASE_INPUT_REQUIRED'; end if;
  select * into v_run from public.dsg_automation_runs where id = p_run_id;
  if v_run.id is null then raise exception 'AUTOMATION_RUN_NOT_FOUND'; end if;
  if v_actor is null then raise exception 'DSG_AUTH_REQUIRED'; end if;
  if not public.dsg_has_permission(v_run.workspace_id, 'job:control') then raise exception 'DSG_PERMISSION_DENIED'; end if;

  insert into public.dsg_automation_leases(
    run_id, step_key, job_id, workspace_id, owner_id, lease_token, expires_at
  ) values (
    p_run_id, p_step_key, v_run.job_id, v_run.workspace_id, p_owner_id, v_token,
    now() + make_interval(secs => p_ttl_seconds)
  )
  on conflict (run_id, step_key) do update set
    owner_id = excluded.owner_id,
    lease_token = excluded.lease_token,
    expires_at = excluded.expires_at,
    updated_at = now()
  where public.dsg_automation_leases.expires_at <= now()
     or public.dsg_automation_leases.owner_id = excluded.owner_id
  returning lease_token into v_token;

  if v_token is null then raise exception 'AUTOMATION_LEASE_HELD'; end if;
  return v_token;
end
$$;

revoke execute on function public.dsg_automation_transition_step(uuid, text, text, text, text, text, timestamptz) from public, anon;
grant execute on function public.dsg_automation_transition_step(uuid, text, text, text, text, text, timestamptz) to authenticated, service_role;
revoke execute on function public.dsg_automation_acquire_lease(uuid, text, text, integer) from public, anon;
grant execute on function public.dsg_automation_acquire_lease(uuid, text, text, integer) to authenticated, service_role;
