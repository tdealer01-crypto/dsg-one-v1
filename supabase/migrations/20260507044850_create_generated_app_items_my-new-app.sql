-- DSG worker generated migration for my-new-app
create table if not exists public.generated_app_items (
  id uuid primary key default gen_random_uuid(),
  app_id text not null,
  title text not null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists generated_app_items_app_id_created_at_idx
  on public.generated_app_items (app_id, created_at desc);
