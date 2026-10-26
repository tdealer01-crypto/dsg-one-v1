-- Run against an isolated, fresh jobs_replay_test database only.
do $$
declare
  expiry bigint := floor(extract(epoch from clock_timestamp()))::bigint + 25;
  accepted boolean;
begin
  if has_function_privilege('anon', 'public.consume_dsg_jobs_delegation(text,bigint)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.consume_dsg_jobs_delegation(text,bigint)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.consume_dsg_jobs_delegation(text,bigint)', 'EXECUTE') then
    raise exception 'REPLAY_RPC_ACL_FAILED';
  end if;
  if has_table_privilege('anon', 'public.dsg_jobs_delegation_receipts', 'SELECT')
     or has_table_privilege('authenticated', 'public.dsg_jobs_delegation_receipts', 'INSERT')
     or has_table_privilege('service_role', 'public.dsg_jobs_delegation_receipts', 'DELETE') then
    raise exception 'REPLAY_TABLE_ACL_FAILED';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.dsg_jobs_delegation_receipts'::regclass) then
    raise exception 'REPLAY_RLS_FAILED';
  end if;

  accepted := public.consume_dsg_jobs_delegation(repeat('a',64), expiry);
  if accepted is distinct from true then raise exception 'FIRST_CONSUME_FAILED'; end if;
  accepted := public.consume_dsg_jobs_delegation(repeat('a',64), expiry);
  if accepted is distinct from false then raise exception 'REPLAY_ACCEPTED'; end if;

  begin
    perform public.consume_dsg_jobs_delegation('invalid', expiry);
    raise exception 'INVALID_RECEIPT_ACCEPTED';
  exception when raise_exception then
    if sqlerrm <> 'DSG_DELEGATION_RECEIPT_INVALID' then raise; end if;
  end;
  begin
    perform public.consume_dsg_jobs_delegation(repeat('b',64), expiry-100);
    raise exception 'EXPIRED_RECEIPT_ACCEPTED';
  exception when raise_exception then
    if sqlerrm <> 'DSG_DELEGATION_RECEIPT_EXPIRED' then raise; end if;
  end;
  begin
    perform public.consume_dsg_jobs_delegation(repeat('b',64), expiry+100);
    raise exception 'OVERLONG_RECEIPT_ACCEPTED';
  exception when raise_exception then
    if sqlerrm <> 'DSG_DELEGATION_RECEIPT_EXPIRED' then raise; end if;
  end;
end;
$$;

-- An application principal may consume, but cannot remove spent receipts.
set role service_role;
select public.consume_dsg_jobs_delegation(repeat('c',64), floor(extract(epoch from clock_timestamp()))::bigint + 25);
reset role;
