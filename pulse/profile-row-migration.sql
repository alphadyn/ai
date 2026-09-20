-- Pulse profile-row repair migration.
-- Run this in the Supabase SQL editor for an existing namespaced Pulse project.
-- It preserves all existing data and does not touch other apps' tables.

alter table public.pulse_profiles add column if not exists status text not null default '';
alter table public.pulse_profiles add column if not exists profile_url text;
alter table public.pulse_profiles add column if not exists name text not null default '';

update public.pulse_profiles set name = username where name = '';

drop policy if exists "users can create own profile" on public.pulse_profiles;
create policy "users can create own profile" on public.pulse_profiles
  for insert with check (auth.uid() = id);

notify pgrst, 'reload schema';