-- Draft Issue #215: apply only as part of the coordinated owner-gated activation.
-- Store hashes only, never assertions, access tokens, subjects or workspace rows.
begin;

create table public.dsg_jobs_delegation_receipts (
  receipt_sha256 text primary key check (receipt_sha256 ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  consumed_at timestamptz not null default clock_timestamp()
);
alter table public.dsg_jobs_delegation_receipts enable row level security;
revoke all on table public.dsg_jobs_delegation_receipts from public, anon, authenticated, service_role;

create function public.consume_dsg_jobs_delegation(
  p_receipt_sha256 text,
  p_expires_at bigint
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  db_now timestamptz := pg_catalog.clock_timestamp();
  expiry timestamptz;
  inserted_count integer;
begin
  if p_receipt_sha256 is null or p_receipt_sha256 !~ '^[0-9a-f]{64}$'
     or p_expires_at is null then
    raise exception 'DSG_DELEGATION_RECEIPT_INVALID';
  end if;
  expiry := pg_catalog.to_timestamp(p_expires_at);
  if expiry <= db_now or expiry > db_now + interval '32 seconds' then
    raise exception 'DSG_DELEGATION_RECEIPT_EXPIRED';
  end if;

  -- Retain beyond the entire verifier acceptance window before reclaiming space.
  delete from public.dsg_jobs_delegation_receipts
    where expires_at < db_now - interval '60 seconds';
  insert into public.dsg_jobs_delegation_receipts(receipt_sha256, expires_at)
    values (p_receipt_sha256, expiry)
    on conflict (receipt_sha256) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count = 1;
end;
$$;
revoke all on function public.consume_dsg_jobs_delegation(text, bigint) from public, anon, authenticated;
grant execute on function public.consume_dsg_jobs_delegation(text, bigint) to service_role;
create index dsg_jobs_delegation_receipts_expiry on public.dsg_jobs_delegation_receipts(expires_at);

commit;
