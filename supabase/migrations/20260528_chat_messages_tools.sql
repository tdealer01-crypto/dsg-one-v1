-- Add tools_used column to existing chat_messages table
alter table chat_messages
  add column if not exists tools_used text[] default '{}';
