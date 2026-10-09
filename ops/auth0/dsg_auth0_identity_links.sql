-- DSG ONE ↔ Auth0 voluntary dual-authenticated account link.
-- Execute only against the Supabase project that serves dsg.pics.
-- No anonymous browser or authenticated PostgREST role may read/write this mapping.
create table if not exists public.dsg_auth0_identity_links (
    actor_id text primary key,
    auth0_sub text not null unique,
    auth0_issuer text not null
        check (auth0_issuer = 'https://dev-kcddqmnusbxxo25s.us.auth0.com/'),
    auth0_client_id text not null
        check (auth0_client_id = 'mLIAcMEAhuVDaUvzXn8Qo54zj2llFp3X'),
    verified_at timestamptz not null default now(),
    constraint dsg_auth0_actor_length check (char_length(actor_id) between 1 and 256),
    constraint dsg_auth0_sub_length check (char_length(auth0_sub) between 1 and 256)
);

alter table public.dsg_auth0_identity_links enable row level security;
alter table public.dsg_auth0_identity_links force row level security;
revoke all on table public.dsg_auth0_identity_links from PUBLIC, anon, authenticated;
revoke all on table public.dsg_auth0_identity_links from service_role;
grant select, insert on table public.dsg_auth0_identity_links to service_role;
-- No UPDATE, DELETE or public policies: re-linking requires a separately
-- authorized administrative procedure and a signed audit record.
