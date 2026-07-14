-- Run in Supabase SQL Editor after 001.
-- Creates an app users row automatically whenever someone signs in for the
-- first time via Supabase Auth (magic link). Default role: rep.
-- Promote managers/admins manually in Table Editor (users.role).

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (auth_user_id, email, name, role)
  values (
    new.id,
    new.email,
    split_part(new.email, '@', 1),
    'rep'
  )
  on conflict (email) do update set auth_user_id = excluded.auth_user_id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
