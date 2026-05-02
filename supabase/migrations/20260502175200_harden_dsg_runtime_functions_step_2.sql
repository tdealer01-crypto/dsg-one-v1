create or replace function public.dsg_touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.dsg_current_actor_id()
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(auth.uid()::text, current_setting('request.jwt.claim.sub', true), current_setting('request.jwt.claims', true)::jsonb->>'sub')
$$;

create or replace function public.dsg_is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.dsg_workspace_members m
    where m.workspace_id = target_workspace_id
      and m.actor_id = public.dsg_current_actor_id()
  )
$$;

create or replace function public.dsg_compute_audit_hash(
  previous_hash text,
  actor_id text,
  action text,
  decision text,
  payload jsonb
)
returns text
language sql
immutable
set search_path = public, extensions, pg_temp
as $$
  select 'sha256:' || encode(digest(coalesce(previous_hash, '') || '|' || actor_id || '|' || action || '|' || decision || '|' || payload::text, 'sha256'), 'hex')
$$;

revoke execute on function public.dsg_touch_updated_at() from anon, authenticated;
revoke execute on function public.dsg_current_actor_id() from anon;
revoke execute on function public.dsg_is_workspace_member(uuid) from anon;
revoke execute on function public.dsg_compute_audit_hash(text, text, text, text, jsonb) from anon;

drop trigger if exists trg_dsg_workspaces_touch on public.dsg_workspaces;
create trigger trg_dsg_workspaces_touch before update on public.dsg_workspaces for each row execute function public.dsg_touch_updated_at();

drop trigger if exists trg_dsg_runtime_jobs_touch on public.dsg_runtime_jobs;
create trigger trg_dsg_runtime_jobs_touch before update on public.dsg_runtime_jobs for each row execute function public.dsg_touch_updated_at();

drop trigger if exists trg_dsg_connectors_touch on public.dsg_connectors;
create trigger trg_dsg_connectors_touch before update on public.dsg_connectors for each row execute function public.dsg_touch_updated_at();
