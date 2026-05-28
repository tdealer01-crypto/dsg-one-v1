-- Chat message history for APK + webhook sessions
create table if not exists chat_messages (
  id           bigserial primary key,
  session_id   text not null,
  role         text not null check (role in ('user', 'assistant')),
  content      text not null,
  dsg_decision text,
  dsg_stamp    text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_chat_messages_session
  on chat_messages (session_id, created_at desc);

alter table chat_messages enable row level security;

create policy "service_role_all" on chat_messages
  for all using (auth.role() = 'service_role');
