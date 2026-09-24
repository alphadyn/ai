-- Adds the Experiences workspace without affecting existing trips or check-ins.
create table if not exists public.checkin_map_experiences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  public_slug text unique not null default gen_random_uuid()::text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.checkin_map_locations
  add column if not exists experience_id uuid references public.checkin_map_experiences(id) on delete cascade;

alter table public.checkin_map_experiences add column if not exists public_slug text;
alter table public.checkin_map_experiences add column if not exists is_public boolean not null default false;
update public.checkin_map_experiences set public_slug = coalesce(public_slug, gen_random_uuid()::text) where public_slug is null;
alter table public.checkin_map_experiences alter column public_slug set not null;
create unique index if not exists checkin_map_experiences_public_slug_idx on public.checkin_map_experiences(public_slug);

create index if not exists checkin_map_locations_experience_id_idx
  on public.checkin_map_locations(experience_id);

alter table public.checkin_map_experiences enable row level security;

drop policy if exists "Check-in Map can read experiences" on public.checkin_map_experiences;
drop policy if exists "Check-in Map can create experiences" on public.checkin_map_experiences;
drop policy if exists "Check-in Map can update experiences" on public.checkin_map_experiences;
drop policy if exists "Check-in Map can delete experiences" on public.checkin_map_experiences;
drop policy if exists "Anyone can read public experiences" on public.checkin_map_experiences;
create policy "Check-in Map can read experiences" on public.checkin_map_experiences for select to authenticated using (user_id = auth.uid() or public.checkin_map_is_admin());
create policy "Anyone can read public experiences" on public.checkin_map_experiences for select to anon using (is_public = true);
create policy "Check-in Map can create experiences" on public.checkin_map_experiences for insert to authenticated with check (user_id = auth.uid());
create policy "Check-in Map can update experiences" on public.checkin_map_experiences for update to authenticated using (user_id = auth.uid() or public.checkin_map_is_admin()) with check (user_id = auth.uid() or public.checkin_map_is_admin());
create policy "Check-in Map can delete experiences" on public.checkin_map_experiences for delete to authenticated using (user_id = auth.uid() or public.checkin_map_is_admin());

drop policy if exists "Anyone can read public experience locations" on public.checkin_map_locations;
create policy "Anyone can read public experience locations" on public.checkin_map_locations for select to anon using (exists (select 1 from public.checkin_map_experiences where id = experience_id and is_public = true));

drop policy if exists "Check-in Map can read locations" on public.checkin_map_locations;
create policy "Check-in Map can read locations" on public.checkin_map_locations for select to authenticated using (
  user_id = auth.uid() or public.checkin_map_is_admin() or exists (
    select 1 from public.checkin_map_experiences e
    where e.id = experience_id and e.user_id = auth.uid()
  )
);

drop policy if exists "Anyone can read public experience media" on public.checkin_map_media;
create policy "Anyone can read public experience media" on public.checkin_map_media for select to anon using (exists (select 1 from public.checkin_map_locations l join public.checkin_map_experiences e on e.id = l.experience_id where l.id = checkin_id and e.is_public = true));

drop policy if exists "Check-in Map can read media" on public.checkin_map_media;
create policy "Check-in Map can read media" on public.checkin_map_media for select to authenticated using (
  user_id = auth.uid() or public.checkin_map_is_admin() or exists (
    select 1 from public.checkin_map_locations l
    join public.checkin_map_experiences e on e.id = l.experience_id
    where l.id = checkin_id and e.user_id = auth.uid()
  )
);

drop policy if exists "Check-in Map can delete media" on public.checkin_map_media;
create policy "Check-in Map can delete media" on public.checkin_map_media for delete to authenticated using (
  user_id = auth.uid() or public.checkin_map_is_admin() or exists (
    select 1 from public.checkin_map_locations l
    join public.checkin_map_experiences e on e.id = l.experience_id
    where l.id = checkin_id and e.user_id = auth.uid()
  )
);

drop policy if exists "Experience owners can delete stored media" on storage.objects;
create or replace function public.checkin_map_can_delete_experience_media(object_name text)
returns boolean language sql security definer set search_path = public
as $$
  select exists (
    select 1 from public.checkin_map_media m
    join public.checkin_map_locations l on l.id = m.checkin_id
    join public.checkin_map_experiences e on e.id = l.experience_id
    where m.storage_path = object_name and (e.user_id = auth.uid() or public.checkin_map_is_admin())
  );
$$;
revoke execute on function public.checkin_map_can_delete_experience_media(text) from public;
grant execute on function public.checkin_map_can_delete_experience_media(text) to authenticated;
create policy "Experience owners can delete stored media" on storage.objects for delete to authenticated using (
  bucket_id = 'checkin-map-media' and public.checkin_map_can_delete_experience_media(name)
);

notify pgrst, 'reload schema';