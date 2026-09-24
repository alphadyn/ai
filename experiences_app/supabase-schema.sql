-- Check-in Map multi-user, multi-trip schema.
create table if not exists public.checkin_map_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null default '',
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function public.checkin_map_is_admin()
returns boolean language sql security definer set search_path = public
as $$ select exists (select 1 from public.checkin_map_profiles where id = auth.uid() and role = 'admin'); $$;

create or replace function public.checkin_map_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$ begin insert into public.checkin_map_profiles (id, username, display_name) values (new.id, lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))), coalesce(new.raw_user_meta_data->>'display_name', '')); return new; end; $$;

drop trigger if exists checkin_map_on_auth_user_created on auth.users;
create trigger checkin_map_on_auth_user_created after insert on auth.users for each row execute procedure public.checkin_map_new_user();

alter table public.checkin_map_profiles add column if not exists username text;
update public.checkin_map_profiles p set username = lower(split_part(u.email, '@', 1)) from auth.users u where p.id = u.id and p.username is null;
alter table public.checkin_map_profiles alter column username set not null;
create unique index if not exists checkin_map_profiles_username_idx on public.checkin_map_profiles(username);

insert into public.checkin_map_profiles (id, username, display_name)
select id, lower(split_part(email, '@', 1)), coalesce(raw_user_meta_data->>'display_name', '') from auth.users
on conflict (id) do nothing;

create table if not exists public.checkin_map_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  public_slug text unique not null default gen_random_uuid()::text,
  is_public boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.checkin_map_locations (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trip_id uuid not null references public.checkin_map_trips(id) on delete cascade,
  lat double precision not null,
  lon double precision not null,
  label text not null,
  event_name text,
  description text not null default '',
  timestamp timestamptz not null,
  type text not null default 'location',
  preview_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.checkin_map_media (
  id text primary key,
  checkin_id text not null references public.checkin_map_locations(id) on delete cascade,
  name text not null,
  mime_type text not null,
  storage_path text not null,
  public_url text not null,
  created_at timestamptz not null default now()
);

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

alter table public.checkin_map_locations add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.checkin_map_locations add column if not exists trip_id uuid references public.checkin_map_trips(id) on delete cascade;
alter table public.checkin_map_locations add column if not exists description text not null default '';
alter table public.checkin_map_locations add column if not exists event_name text;
alter table public.checkin_map_locations add column if not exists experience_id uuid references public.checkin_map_experiences(id) on delete cascade;
create index if not exists checkin_map_locations_experience_id_idx on public.checkin_map_locations(experience_id);
alter table public.checkin_map_experiences add column if not exists public_slug text;
alter table public.checkin_map_experiences add column if not exists is_public boolean not null default false;
update public.checkin_map_experiences set public_slug = coalesce(public_slug, gen_random_uuid()::text) where public_slug is null;
alter table public.checkin_map_experiences alter column public_slug set not null;
create unique index if not exists checkin_map_experiences_public_slug_idx on public.checkin_map_experiences(public_slug);
alter table public.checkin_map_media add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.checkin_map_media alter column user_id set default auth.uid();
alter table public.checkin_map_trips add column if not exists public_slug text;
alter table public.checkin_map_trips add column if not exists is_public boolean not null default false;
alter table public.checkin_map_trips add column if not exists sort_order integer not null default 0;
update public.checkin_map_trips set public_slug = coalesce(public_slug, gen_random_uuid()::text) where public_slug is null;
with ranked_trips as (
  select id, row_number() over (partition by user_id order by created_at asc) as position
  from public.checkin_map_trips
)
update public.checkin_map_trips t set sort_order = ranked_trips.position from ranked_trips where t.id = ranked_trips.id and t.sort_order = 0;
alter table public.checkin_map_trips alter column public_slug set not null;
create unique index if not exists checkin_map_trips_public_slug_idx on public.checkin_map_trips(public_slug);

alter table public.checkin_map_profiles enable row level security;
alter table public.checkin_map_profiles add column if not exists avatar_url text;
alter table public.checkin_map_trips enable row level security;
alter table public.checkin_map_locations enable row level security;
alter table public.checkin_map_media enable row level security;
alter table public.checkin_map_experiences enable row level security;

drop policy if exists "Check-in Map can read profiles" on public.checkin_map_profiles;
drop policy if exists "Check-in Map can update profiles" on public.checkin_map_profiles;
drop policy if exists "Check-in Map can update own profile" on public.checkin_map_profiles;
drop policy if exists "Check-in Map admins can update profiles" on public.checkin_map_profiles;
create policy "Check-in Map can read profiles" on public.checkin_map_profiles for select to authenticated using (id = auth.uid() or public.checkin_map_is_admin());
create policy "Check-in Map can update own profile" on public.checkin_map_profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and role = 'user');
create policy "Check-in Map admins can update profiles" on public.checkin_map_profiles for update to authenticated using (public.checkin_map_is_admin()) with check (public.checkin_map_is_admin());

drop policy if exists "Check-in Map can read trips" on public.checkin_map_trips;
drop policy if exists "Check-in Map can create trips" on public.checkin_map_trips;
drop policy if exists "Check-in Map can update trips" on public.checkin_map_trips;
drop policy if exists "Check-in Map can delete trips" on public.checkin_map_trips;
drop policy if exists "Anyone can read public trips" on public.checkin_map_trips;
create policy "Check-in Map can read trips" on public.checkin_map_trips for select to authenticated using (user_id = auth.uid() or public.checkin_map_is_admin());
create policy "Anyone can read public trips" on public.checkin_map_trips for select to anon using (is_public = true);
create policy "Check-in Map can create trips" on public.checkin_map_trips for insert to authenticated with check (user_id = auth.uid());
create policy "Check-in Map can update trips" on public.checkin_map_trips for update to authenticated using (user_id = auth.uid() or public.checkin_map_is_admin()) with check (user_id = auth.uid() or public.checkin_map_is_admin());
create policy "Check-in Map can delete trips" on public.checkin_map_trips for delete to authenticated using (user_id = auth.uid() or public.checkin_map_is_admin());

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

drop policy if exists "Check-in Map can read locations" on public.checkin_map_locations;
drop policy if exists "Check-in Map can create locations" on public.checkin_map_locations;
drop policy if exists "Check-in Map can update locations" on public.checkin_map_locations;
drop policy if exists "Check-in Map can delete locations" on public.checkin_map_locations;
drop policy if exists "Anyone can read public locations" on public.checkin_map_locations;
create policy "Check-in Map can read locations" on public.checkin_map_locations for select to authenticated using (
  user_id = auth.uid() or public.checkin_map_is_admin() or exists (
    select 1 from public.checkin_map_experiences e
    where e.id = experience_id and e.user_id = auth.uid()
  )
);
create policy "Anyone can read public locations" on public.checkin_map_locations for select to anon using (exists (select 1 from public.checkin_map_trips where id = trip_id and is_public = true));
drop policy if exists "Anyone can read public experience locations" on public.checkin_map_locations;
create policy "Anyone can read public experience locations" on public.checkin_map_locations for select to anon using (exists (select 1 from public.checkin_map_experiences where id = experience_id and is_public = true));
create policy "Check-in Map can create locations" on public.checkin_map_locations for insert to authenticated with check (user_id = auth.uid());
create policy "Check-in Map can update locations" on public.checkin_map_locations for update to authenticated using (user_id = auth.uid() or public.checkin_map_is_admin()) with check (user_id = auth.uid() or public.checkin_map_is_admin());
create policy "Check-in Map can delete locations" on public.checkin_map_locations for delete to authenticated using (user_id = auth.uid() or public.checkin_map_is_admin());

drop policy if exists "Check-in Map can read media" on public.checkin_map_media;
drop policy if exists "Check-in Map can create media" on public.checkin_map_media;
drop policy if exists "Check-in Map can delete media" on public.checkin_map_media;
drop policy if exists "Anyone can read public media" on public.checkin_map_media;
create policy "Check-in Map can read media" on public.checkin_map_media for select to authenticated using (
  user_id = auth.uid() or public.checkin_map_is_admin() or exists (
    select 1 from public.checkin_map_locations l
    join public.checkin_map_experiences e on e.id = l.experience_id
    where l.id = checkin_id and e.user_id = auth.uid()
  )
);
create policy "Anyone can read public media" on public.checkin_map_media for select to anon using (exists (select 1 from public.checkin_map_locations l join public.checkin_map_trips t on t.id = l.trip_id where l.id = checkin_id and t.is_public = true));
drop policy if exists "Anyone can read public experience media" on public.checkin_map_media;
create policy "Anyone can read public experience media" on public.checkin_map_media for select to anon using (exists (select 1 from public.checkin_map_locations l join public.checkin_map_experiences e on e.id = l.experience_id where l.id = checkin_id and e.is_public = true));
create policy "Check-in Map can create media" on public.checkin_map_media for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.checkin_map_locations where id = checkin_id and (user_id = auth.uid() or public.checkin_map_is_admin())));
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

insert into storage.buckets (id, name, public)
values ('checkin-map-media', 'checkin-map-media', true)
on conflict (id) do update set public = true;

drop policy if exists "Check-in Map can read stored media" on storage.objects;
drop policy if exists "Check-in Map can upload stored media" on storage.objects;
drop policy if exists "Check-in Map can delete stored media" on storage.objects;
create policy "Check-in Map can read stored media" on storage.objects for select to authenticated using (bucket_id = 'checkin-map-media');
create policy "Check-in Map can upload stored media" on storage.objects for insert to authenticated with check (bucket_id = 'checkin-map-media' and (name like 'avatars/' || auth.uid()::text || '.%' or split_part(name, '/', 1) = auth.uid()::text));
create policy "Check-in Map can delete stored media" on storage.objects for delete to authenticated using (bucket_id = 'checkin-map-media' and (name like 'avatars/' || auth.uid()::text || '.%' or split_part(name, '/', 1) = auth.uid()::text));

notify pgrst, 'reload schema';
