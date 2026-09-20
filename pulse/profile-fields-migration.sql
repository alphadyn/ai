-- Pulse profile fields migration
-- Run this once in the Supabase SQL Editor for an existing Pulse project.
-- This preserves all existing users, posts, comments, and votes. Existing
-- profiles get their current username copied into the new display name.

alter table public.pulse_profiles
  add column if not exists status text not null default '',
  add column if not exists profile_url text,
  add column if not exists name text not null default '';

update public.pulse_profiles
set name = username
where name = '';

alter table public.pulse_profiles
  drop constraint if exists pulse_profiles_name_length;

alter table public.pulse_profiles
  add constraint pulse_profiles_name_length check (char_length(name) <= 80);

alter table public.pulse_profiles
  drop constraint if exists pulse_profiles_status_length;

alter table public.pulse_profiles
  add constraint pulse_profiles_status_length check (char_length(status) <= 160);

alter table public.pulse_profiles
  drop constraint if exists pulse_profiles_profile_url_length;

alter table public.pulse_profiles
  add constraint pulse_profiles_profile_url_length
  check (profile_url is null or char_length(profile_url) <= 2000);

notify pgrst, 'reload schema';
