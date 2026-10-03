-- Keep dsg_automation_runs.status synchronized with durable step state.
-- This intentionally does NOT mutate dsg_runtime_jobs.status: the runtime job
-- lifecycle remains governed by approval/completion-report semantics.

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
  v_existing_run_status text;
  v_total_steps integer;
  v_completed_steps integer;
  v_has_failed boolean;
  v_has_killed boolean;
  v_has_blocked boolean;
  v_has_waiting boolean;
  v_has_retrying boolean;
  v_has_running boolean;
  v_has_ready boolean;
  v_run_status text;
begin
  select r.workspace_id, r.status
  into v_workspace_id, v_existing_run_status
  from public.dsg_automation_runs r
  where r.id = p_run_id
  for update;

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

  select
    count(*)::integer,
    count(*) filter (where status = 'COMPLETED')::integer,
    coalesce(bool_or(status = 'FAILED'), false),
    coalesce(bool_or(status = 'KILLED'), false),
    coalesce(bool_or(status = 'BLOCKED'), false),
    coalesce(bool_or(status = 'WAITING'), false),
    coalesce(bool_or(status = 'RETRYING'), false),
    coalesce(bool_or(status = 'RUNNING'), false),
    coalesce(bool_or(status = 'READY'), false)
  into
    v_total_steps,
    v_completed_steps,
    v_has_failed,
    v_has_killed,
    v_has_blocked,
    v_has_waiting,
    v_has_retrying,
    v_has_running,
    v_has_ready
  from public.dsg_automation_steps
  where run_id = p_run_id;

  v_run_status := case
    when v_has_failed then 'FAILED'
    when v_has_killed then 'KILLED'
    when v_has_blocked then 'BLOCKED'
    when v_total_steps > 0 and v_completed_steps = v_total_steps then 'COMPLETED'
    when v_existing_run_status = 'PAUSED' then 'PAUSED'
    when v_existing_run_status = 'VERIFYING' then 'VERIFYING'
    when v_has_waiting then 'WAITING'
    when v_has_retrying then 'RETRYING'
    when v_has_running or v_has_ready or v_completed_steps > 0 then 'RUNNING'
    else 'CREATED'
  end;

  update public.dsg_automation_runs
  set status = v_run_status,
      updated_at = now()
  where id = p_run_id;

  return jsonb_build_object(
    'task_id', p_task_id,
    'status', p_next_status,
    'attempt', v_attempt,
    'run_status', v_run_status
  );
end
$$;

revoke execute on function public.dsg_automation_transition_step(uuid, text, text, text, text, text, timestamptz) from public, anon;
grant execute on function public.dsg_automation_transition_step(uuid, text, text, text, text, text, timestamptz) to authenticated, service_role;

-- Backfill only the automation-run aggregate. Formal dsg_runtime_jobs status is
-- deliberately untouched because completion-report semantics own that lifecycle.
with aggregates as (
  select
    run_id,
    count(*)::integer as total_steps,
    count(*) filter (where status = 'COMPLETED')::integer as completed_steps,
    coalesce(bool_or(status = 'FAILED'), false) as has_failed,
    coalesce(bool_or(status = 'KILLED'), false) as has_killed,
    coalesce(bool_or(status = 'BLOCKED'), false) as has_blocked,
    coalesce(bool_or(status = 'WAITING'), false) as has_waiting,
    coalesce(bool_or(status = 'RETRYING'), false) as has_retrying,
    coalesce(bool_or(status = 'RUNNING'), false) as has_running,
    coalesce(bool_or(status = 'READY'), false) as has_ready
  from public.dsg_automation_steps
  group by run_id
),
derived as (
  select
    r.id,
    case
      when a.has_failed then 'FAILED'
      when a.has_killed then 'KILLED'
      when a.has_blocked then 'BLOCKED'
      when a.total_steps > 0 and a.completed_steps = a.total_steps then 'COMPLETED'
      when r.status = 'PAUSED' then 'PAUSED'
      when r.status = 'VERIFYING' then 'VERIFYING'
      when a.has_waiting then 'WAITING'
      when a.has_retrying then 'RETRYING'
      when a.has_running or a.has_ready or a.completed_steps > 0 then 'RUNNING'
      else 'CREATED'
    end as derived_status
  from public.dsg_automation_runs r
  join aggregates a on a.run_id = r.id
)
update public.dsg_automation_runs r
set status = d.derived_status,
    updated_at = now()
from derived d
where r.id = d.id
  and r.status is distinct from d.derived_status;
