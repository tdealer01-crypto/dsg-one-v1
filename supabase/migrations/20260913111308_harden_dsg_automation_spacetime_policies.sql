revoke all on table public.dsg_automation_runs from anon;
revoke all on table public.dsg_automation_steps from anon;
revoke all on table public.dsg_automation_checkpoints from anon;
revoke all on table public.dsg_automation_handoffs from anon;
revoke all on table public.dsg_automation_timers from anon;
revoke all on table public.dsg_automation_leases from anon;

grant select on table public.dsg_automation_runs to authenticated;
grant select on table public.dsg_automation_steps to authenticated;
grant select on table public.dsg_automation_checkpoints to authenticated;
grant select on table public.dsg_automation_handoffs to authenticated;
grant select on table public.dsg_automation_timers to authenticated;
grant select on table public.dsg_automation_leases to authenticated;

drop policy if exists dsg_automation_read on public.dsg_automation_runs;
create policy dsg_automation_read on public.dsg_automation_runs
for select to authenticated using (public.dsg_has_permission(workspace_id, 'job:read'));

drop policy if exists dsg_automation_read on public.dsg_automation_steps;
create policy dsg_automation_read on public.dsg_automation_steps
for select to authenticated using (public.dsg_has_permission(workspace_id, 'job:read'));

drop policy if exists dsg_automation_read on public.dsg_automation_checkpoints;
create policy dsg_automation_read on public.dsg_automation_checkpoints
for select to authenticated using (public.dsg_has_permission(workspace_id, 'job:read'));

drop policy if exists dsg_automation_read on public.dsg_automation_handoffs;
create policy dsg_automation_read on public.dsg_automation_handoffs
for select to authenticated using (public.dsg_has_permission(workspace_id, 'job:read'));

drop policy if exists dsg_automation_read on public.dsg_automation_timers;
create policy dsg_automation_read on public.dsg_automation_timers
for select to authenticated using (public.dsg_has_permission(workspace_id, 'job:read'));

drop policy if exists dsg_automation_read on public.dsg_automation_leases;
create policy dsg_automation_read on public.dsg_automation_leases
for select to authenticated using (public.dsg_has_permission(workspace_id, 'job:read'));
