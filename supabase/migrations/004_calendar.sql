-- Calendar connection state. Run in Supabase SQL Editor after 003.

alter table users add column recall_calendar_id text;
alter table users add column calendar_email text;
alter table users add column calendar_connected_at_v2 timestamptz;

-- Track which calendar events we've scheduled bots for (dedupe + toggle support)
create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  recall_event_id text unique not null,
  recall_calendar_id text not null,
  user_id uuid references users(id),
  title text,
  start_time timestamptz,
  end_time timestamptz,
  meeting_url text,
  is_external boolean not null default false,
  bot_scheduled boolean not null default false,
  rep_override text check (rep_override in ('force_record', 'skip')), -- per-meeting toggle
  updated_at timestamptz not null default now()
);
create index calendar_events_user_idx on calendar_events(user_id, start_time);

alter table calendar_events enable row level security;
create policy calendar_events_select on calendar_events for select using (
  user_id = app_user_id() or app_user_role() in ('manager', 'admin')
);
