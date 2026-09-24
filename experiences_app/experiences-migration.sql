-- Adds the Experiences workspace without affecting existing trips or check-ins.
create table if not exists public.checkin_map_experiences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trip_id uuid references public.checkin_map_trips(id) on delete cascade,
  name text not null,
  description text not null default '',
  public_slug text unique not null default gen_random_uuid()::text,
  is_public boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.checkin_map_locations
  add column if not exists experience_id uuid references public.checkin_map_experiences(id) on delete cascade;
alter table public.checkin_map_locations
  add column if not exists event_name text;

alter table public.checkin_map_experiences add column if not exists public_slug text;
alter table public.checkin_map_experiences add column if not exists is_public boolean not null default false;
alter table public.checkin_map_experiences add column if not exists sort_order integer not null default 0;
alter table public.checkin_map_experiences add column if not exists trip_id uuid references public.checkin_map_trips(id) on delete cascade;
update public.checkin_map_experiences e set trip_id = source.trip_id from (
  select distinct on (experience_id) experience_id, trip_id
  from public.checkin_map_locations
  where experience_id is not null
  order by experience_id, created_at asc
) source where e.id = source.experience_id and e.trip_id is null;
update public.checkin_map_experiences set public_slug = coalesce(public_slug, gen_random_uuid()::text) where public_slug is null;
with ranked_experiences as (
  select id, row_number() over (partition by user_id order by created_at asc) as position
  from public.checkin_map_experiences
)
update public.checkin_map_experiences e set sort_order = ranked_experiences.position from ranked_experiences where e.id = ranked_experiences.id and e.sort_order = 0;
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

create or replace function public.checkin_map_add_public_experience_event(
  experience_slug text,
  event_id text,
  event_name text,
  event_label text,
  event_lat double precision,
  event_lon double precision,
  event_timestamp timestamptz,
  event_description text default ''
)
returns void language plpgsql security definer set search_path = public
as $$
declare shared_experience public.checkin_map_experiences%rowtype;
begin
  select * into shared_experience from public.checkin_map_experiences where public_slug = experience_slug and is_public = true;
  if not found or shared_experience.trip_id is null then raise exception 'This public experience cannot accept events.'; end if;
  insert into public.checkin_map_locations (id, user_id, trip_id, experience_id, event_name, lat, lon, label, description, timestamp, type)
  values (event_id, shared_experience.user_id, shared_experience.trip_id, shared_experience.id, event_name, event_lat, event_lon, event_label, event_description, event_timestamp, 'event');
end;
$$;
revoke execute on function public.checkin_map_add_public_experience_event(text, text, text, text, double precision, double precision, timestamptz, text) from public;
grant execute on function public.checkin_map_add_public_experience_event(text, text, text, text, double precision, double precision, timestamptz, text) to anon, authenticated;

create or replace function public.checkin_map_update_public_experience_event(
  experience_slug text,
  event_id text,
  event_name text,
  event_label text,
  event_lat double precision,
  event_lon double precision,
  event_timestamp timestamptz,
  event_description text default ''
)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.checkin_map_locations l
  set event_name = checkin_map_update_public_experience_event.event_name,
      label = event_label,
      lat = event_lat,
      lon = event_lon,
      timestamp = event_timestamp,
      description = event_description,
      updated_at = now()
  from public.checkin_map_experiences e
  where l.id = event_id and l.experience_id = e.id and e.public_slug = experience_slug and e.is_public = true;
  if not found then raise exception 'This public experience event cannot be updated.'; end if;
end;
$$;
revoke execute on function public.checkin_map_update_public_experience_event(text, text, text, text, double precision, double precision, timestamptz, text) from public;
grant execute on function public.checkin_map_update_public_experience_event(text, text, text, text, double precision, double precision, timestamptz, text) to anon, authenticated;

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