-- SalesSense initial schema (Phase 1)
-- Run this in Supabase: SQL Editor → New query → paste → Run.

-- Enable pgvector for semantic search
create extension if not exists vector;

-- ============ Core tables ============

create table users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id),
  email text unique not null,
  name text,
  role text not null default 'rep' check (role in ('rep', 'manager', 'admin')),
  calendar_connected_at timestamptz,
  created_at timestamptz not null default now()
);

create table deals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company_domain text,               -- auto-grouping key (e.g. 'acme.com')
  salesforce_opportunity_id text,    -- reserved for Phase 2
  status text not null default 'open' check (status in ('open', 'won', 'lost', 'archived')),
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);
create index deals_domain_idx on deals(company_domain);

create table interactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('meeting', 'email', 'call')),
  deal_id uuid references deals(id),
  user_id uuid references users(id), -- owning rep
  occurred_at timestamptz not null,
  title text,
  source text not null check (source in ('recall', 'gmail', 'sfdc')),
  source_ref text,                   -- e.g. Recall bot id
  duration_s integer,
  status text not null default 'pending'
    check (status in ('pending', 'recording', 'processing', 'ready', 'failed')),
  failure_reason text,               -- visible "missed meeting" reason
  created_at timestamptz not null default now()
);
create index interactions_deal_idx on interactions(deal_id);
create index interactions_user_idx on interactions(user_id);

create table participants (
  id uuid primary key default gen_random_uuid(),
  interaction_id uuid not null references interactions(id) on delete cascade,
  email text,
  name text,
  is_external boolean not null default false,
  speaker_label text,                -- diarization label mapped to this person
  talk_ms integer,                   -- computed from diarized segments
  talk_pct numeric(5,2)
);
create index participants_interaction_idx on participants(interaction_id);

create table transcript_segments (
  id uuid primary key default gen_random_uuid(),
  interaction_id uuid not null references interactions(id) on delete cascade,
  speaker_label text,
  start_ms integer not null,
  end_ms integer not null,
  text text not null
);
create index segments_interaction_idx on transcript_segments(interaction_id);

create table insights (
  id uuid primary key default gen_random_uuid(),
  interaction_id uuid references interactions(id) on delete cascade,
  deal_id uuid references deals(id),
  kind text not null check (kind in
    ('summary', 'action_item', 'email_draft', 'crm_note', 'deal_rollup', 'signal', 'score')),
  payload jsonb not null,
  segment_ids uuid[],                -- provenance: which transcript segments support this
  prompt_version text,
  model text,
  confidence numeric(3,2),
  created_at timestamptz not null default now()
);
create index insights_interaction_idx on insights(interaction_id);
create index insights_deal_idx on insights(deal_id);

-- Living scoping profile: append-only; latest row per field = current value
create table deal_scoping (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  field text not null check (field in
    ('num_users', 'volume', 'capture', 'storage', 'workflows', 'integrations')),
  value text not null,
  unit text,
  context text,                      -- surrounding detail, e.g. "10k invoices/month, AP dept only"
  interaction_id uuid references interactions(id),
  segment_ids uuid[],
  superseded_by uuid references deal_scoping(id),  -- set when a later value replaces this (change flag)
  created_at timestamptz not null default now()
);
create index deal_scoping_deal_idx on deal_scoping(deal_id, field);

-- Per-attendee intelligence, accumulated across meetings on a deal
create table attendee_profiles (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  email text not null,
  name text,
  pain_points jsonb not null default '[]',   -- [{text, interaction_id, segment_ids}]
  interests jsonb not null default '[]',     -- product/feature interest
  rapport_notes jsonb not null default '[]', -- personal details for relationship building
  updated_at timestamptz not null default now(),
  unique (deal_id, email)
);

create table feedback (
  id uuid primary key default gen_random_uuid(),
  insight_id uuid not null references insights(id) on delete cascade,
  user_id uuid references users(id),
  rating text not null check (rating in ('up', 'down')),
  comment text,
  created_at timestamptz not null default now()
);

create table embeddings (
  id uuid primary key default gen_random_uuid(),
  interaction_id uuid not null references interactions(id) on delete cascade,
  chunk_text text not null,
  embedding vector(1536)
);
create index embeddings_vector_idx on embeddings
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create table recordings (
  id uuid primary key default gen_random_uuid(),
  interaction_id uuid not null references interactions(id) on delete cascade,
  audio_url text,
  expires_at timestamptz              -- retention: audio auto-deleted after N days
);

-- ============ Row-Level Security ============
-- Rule: reps see their own interactions (and related rows); managers/admins see everything.

alter table users enable row level security;
alter table deals enable row level security;
alter table interactions enable row level security;
alter table participants enable row level security;
alter table transcript_segments enable row level security;
alter table insights enable row level security;
alter table deal_scoping enable row level security;
alter table attendee_profiles enable row level security;
alter table feedback enable row level security;
alter table embeddings enable row level security;
alter table recordings enable row level security;

-- Helper: current app user id and role from the authenticated Supabase user
create or replace function app_user_id() returns uuid language sql stable as
  $$ select id from users where auth_user_id = auth.uid() $$;
create or replace function app_user_role() returns text language sql stable as
  $$ select role from users where auth_user_id = auth.uid() $$;

-- Users: everyone can see the team roster; only admins modify
create policy users_select on users for select using (true);

-- Deals: visible to all authenticated users (deals are team-shared)
create policy deals_select on deals for select using (auth.uid() is not null);
create policy deals_insert on deals for insert with check (auth.uid() is not null);
create policy deals_update on deals for update using (auth.uid() is not null);

-- Interactions: own rows for reps, all rows for managers/admins
create policy interactions_select on interactions for select using (
  user_id = app_user_id() or app_user_role() in ('manager', 'admin')
);

-- Child tables inherit visibility from their interaction
create policy participants_select on participants for select using (
  exists (select 1 from interactions i where i.id = interaction_id
          and (i.user_id = app_user_id() or app_user_role() in ('manager', 'admin')))
);
create policy segments_select on transcript_segments for select using (
  exists (select 1 from interactions i where i.id = interaction_id
          and (i.user_id = app_user_id() or app_user_role() in ('manager', 'admin')))
);
create policy insights_select on insights for select using (
  interaction_id is null
  or exists (select 1 from interactions i where i.id = interaction_id
             and (i.user_id = app_user_id() or app_user_role() in ('manager', 'admin')))
);
create policy recordings_select on recordings for select using (
  exists (select 1 from interactions i where i.id = interaction_id
          and (i.user_id = app_user_id() or app_user_role() in ('manager', 'admin')))
);
create policy embeddings_select on embeddings for select using (
  exists (select 1 from interactions i where i.id = interaction_id
          and (i.user_id = app_user_id() or app_user_role() in ('manager', 'admin')))
);

-- Deal-level intelligence: team-shared (like deals)
create policy deal_scoping_select on deal_scoping for select using (auth.uid() is not null);
create policy attendee_profiles_select on attendee_profiles for select using (auth.uid() is not null);

-- Feedback: users manage their own
create policy feedback_select on feedback for select using (auth.uid() is not null);
create policy feedback_insert on feedback for insert with check (user_id = app_user_id());

-- NOTE: All writes from the ingestion pipeline use the service-role key (bypasses RLS),
-- so insert/update policies for pipeline tables are intentionally omitted in Phase 1.
