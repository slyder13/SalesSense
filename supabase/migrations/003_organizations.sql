-- Multi-tenancy skeleton. Run in Supabase SQL Editor after 001 and 002.
-- Everything defaults to the Square 9 org for now; real multi-org machinery
-- (signup, isolation policies, billing) comes much later. This just makes sure
-- every row knows which company it belongs to from day one.

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  allowed_domains text[] not null default '{}',  -- email domains whose users belong here
  created_at timestamptz not null default now()
);

-- Fixed, well-known id for the Square 9 org so column defaults can reference it
insert into organizations (id, name, allowed_domains)
values ('00000000-0000-0000-0000-000000000001', 'Square 9 Softworks', '{square-9.com}');

-- Stamp org_id on the three root tables (children inherit via deal_id / interaction_id)
alter table users add column org_id uuid not null
  references organizations(id) default '00000000-0000-0000-0000-000000000001';
alter table deals add column org_id uuid not null
  references organizations(id) default '00000000-0000-0000-0000-000000000001';
alter table interactions add column org_id uuid not null
  references organizations(id) default '00000000-0000-0000-0000-000000000001';

create index users_org_idx on users(org_id);
create index deals_org_idx on deals(org_id);
create index interactions_org_idx on interactions(org_id);

-- Update the auth trigger to also assign the org by email domain
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_org uuid;
begin
  select id into v_org from organizations
    where split_part(new.email, '@', 2) = any(allowed_domains)
    limit 1;

  insert into public.users (auth_user_id, email, name, role, org_id)
  values (
    new.id,
    new.email,
    split_part(new.email, '@', 1),
    'rep',
    coalesce(v_org, '00000000-0000-0000-0000-000000000001')
  )
  on conflict (email) do update set auth_user_id = excluded.auth_user_id;
  return new;
end;
$$;
