-- Check-in Map multi-user, multi-trip schema.
create table if not exists public.checkin_map_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function public.checkin_map_is_admin()
returns boolean language sql security definer set search_path = public
as $$ select exists (select 1 from public.checkin_map_profiles where id = auth.uid() and role = 'admin'); $$;

create or replace function public.checkin_map_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$ begin insert into public.checkin_map_profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name', '')); return new; end; $$;

drop trigger if exists checkin_map_on_auth_user_created on auth.users;
create trigger checkin_map_on_auth_user_created after insert on auth.users for each row execute procedure public.checkin_map_new_user();

insert into public.checkin_map_profiles (id, display_name)
select id, coalesce(raw_user_meta_data->>'display_name', '') from auth.users
on conflict (id) do nothing;

create table if not exists public.checkin_map_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  public_slug text unique not null default gen_random_uuid()::text,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.checkin_map_locations (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trip_id uuid not null references public.checkin_map_trips(id) on delete cascade,
  lat double precision not null,
  lon double precision not null,
  label text not null,
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

alter table public.checkin_map_locations add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.checkin_map_locations add column if not exists trip_id uuid references public.checkin_map_trips(id) on delete cascade;
alter table public.checkin_map_media add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.checkin_map_media alter column user_id set default auth.uid();
alter table public.checkin_map_trips add column if not exists public_slug text;
alter table public.checkin_map_trips add column if not exists is_public boolean not null default false;
update public.checkin_map_trips set public_slug = coalesce(public_slug, gen_random_uuid()::text) where public_slug is null;
alter table public.checkin_map_trips alter column public_slug set not null;
create unique index if not exists checkin_map_trips_public_slug_idx on public.checkin_map_trips(public_slug);

alter table public.checkin_map_profiles enable row level security;
alter table public.checkin_map_trips enable row level security;
alter table public.checkin_map_locations enable row level security;
alter table public.checkin_map_media enable row level security;

drop policy if exists "Check-in Map can read profiles" on public.checkin_map_profiles;
drop policy if exists "Check-in Map can update profiles" on public.checkin_map_profiles;
create policy "Check-in Map can read profiles" on public.checkin_map_profiles for select to authenticated using (id = auth.uid() or public.checkin_map_is_admin());
create policy "Check-in Map can update own profile" on public.checkin_map_profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and role = 'user');
create policy "Check-in Map admins can update profiles" on public.checkin_map_profiles for update to authenticated using (public.checkin_map_is_admin()) with check (public.checkin_map_is_admin());

drop policy if exists "Check-in Map can read trips" on public.checkin_map_trips;
drop policy if exists "Check-in Map can create trips" on public.checkin_map_trips;
drop policy if exists "Check-in Map can update trips" on public.checkin_map_trips;
drop policy if exists "Check-in Map can delete trips" on public.checkin_map_trips;
create policy "Check-in Map can read trips" on public.checkin_map_trips for select to authenticated using (user_id = auth.uid() or public.checkin_map_is_admin());
create policy "Anyone can read public trips" on public.checkin_map_trips for select to anon using (is_public = true);
create policy "Check-in Map can create trips" on public.checkin_map_trips for insert to authenticated with check (user_id = auth.uid());
create policy "Check-in Map can update trips" on public.checkin_map_trips for update to authenticated using (user_id = auth.uid() or public.checkin_map_is_admin()) with check (user_id = auth.uid() or public.checkin_map_is_admin());
create policy "Check-in Map can delete trips" on public.checkin_map_trips for delete to authenticated using (user_id = auth.uid() or public.checkin_map_is_admin());

drop policy if exists "Check-in Map can read locations" on public.checkin_map_locations;
drop policy if exists "Check-in Map can create locations" on public.checkin_map_locations;
drop policy if exists "Check-in Map can update locations" on public.checkin_map_locations;
drop policy if exists "Check-in Map can delete locations" on public.checkin_map_locations;
create policy "Check-in Map can read locations" on public.checkin_map_locations for select to authenticated using (user_id = auth.uid() or public.checkin_map_is_admin());
create policy "Anyone can read public locations" on public.checkin_map_locations for select to anon using (exists (select 1 from public.checkin_map_trips where id = trip_id and is_public = true));
create policy "Check-in Map can create locations" on public.checkin_map_locations for insert to authenticated with check (user_id = auth.uid());
create policy "Check-in Map can update locations" on public.checkin_map_locations for update to authenticated using (user_id = auth.uid() or public.checkin_map_is_admin()) with check (user_id = auth.uid() or public.checkin_map_is_admin());
create policy "Check-in Map can delete locations" on public.checkin_map_locations for delete to authenticated using (user_id = auth.uid() or public.checkin_map_is_admin());

drop policy if exists "Check-in Map can read media" on public.checkin_map_media;
drop policy if exists "Check-in Map can create media" on public.checkin_map_media;
drop policy if exists "Check-in Map can delete media" on public.checkin_map_media;
create policy "Check-in Map can read media" on public.checkin_map_media for select to authenticated using (user_id = auth.uid() or public.checkin_map_is_admin());
create policy "Anyone can read public media" on public.checkin_map_media for select to anon using (exists (select 1 from public.checkin_map_locations l join public.checkin_map_trips t on t.id = l.trip_id where l.id = checkin_id and t.is_public = true));
create policy "Check-in Map can create media" on public.checkin_map_media for insert to authenticated with check (user_id = auth.uid());
create policy "Check-in Map can delete media" on public.checkin_map_media for delete to authenticated using (user_id = auth.uid() or public.checkin_map_is_admin());

insert into storage.buckets (id, name, public)
values ('checkin-map-media', 'checkin-map-media', true)
on conflict (id) do update set public = true;

drop policy if exists "Check-in Map can read stored media" on storage.objects;
drop policy if exists "Check-in Map can upload stored media" on storage.objects;
drop policy if exists "Check-in Map can delete stored media" on storage.objects;
create policy "Check-in Map can read stored media" on storage.objects for select to authenticated using (bucket_id = 'checkin-map-media');
create policy "Check-in Map can upload stored media" on storage.objects for insert to authenticated with check (bucket_id = 'checkin-map-media');
create policy "Check-in Map can delete stored media" on storage.objects for delete to authenticated using (bucket_id = 'checkin-map-media');

notify pgrst, 'reload schema';
