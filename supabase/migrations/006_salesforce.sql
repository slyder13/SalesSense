-- Salesforce connection (org-level: one Salesforce org per SalesSense org).
-- Run in Supabase SQL Editor after 005.

create table salesforce_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) unique,
  instance_url text not null,          -- e.g. https://square9.my.salesforce.com
  refresh_token text not null,         -- long-lived; used to mint access tokens
  connected_by text,                   -- email of whoever connected it
  connected_at timestamptz not null default now()
);

alter table salesforce_connections enable row level security;
-- No select policy: tokens are only ever read server-side with the service key.

-- Cache of linked opp fields shown on the deal page
alter table deals add column sf_stage text;
alter table deals add column sf_amount numeric;
alter table deals add column sf_close_date date;
alter table deals add column sf_account_name text;
alter table deals add column sf_synced_at timestamptz;
