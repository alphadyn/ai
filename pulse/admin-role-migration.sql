-- Pulse admin role migration.
--
-- Run this in the Supabase SQL editor if an admin user can log in but the
-- Pulse Admin screen still says "Admin access required." This preserves all
-- Pulse data and only updates the admin helper used by RLS policies.

create or replace function public.pulse_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    auth.jwt()->'app_metadata'->>'role',
    auth.jwt()->'app_metadata'->>'user_role',
    auth.jwt()->'user_metadata'->>'role',
    auth.jwt()->'user_metadata'->>'user_role',
    ''
  ) = 'admin'
  or exists (select 1 from public.pulse_profiles where id = auth.uid() and role = 'admin');
$$;

grant execute on function public.pulse_is_admin() to anon, authenticated;

notify pgrst, 'reload schema';
