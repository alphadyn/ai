-- Check-in Map persistent locations and media.
create table if not exists public.checkin_map_locations (
  id text primary key,
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

alter table public.checkin_map_locations enable row level security;
alter table public.checkin_map_media enable row level security;

drop policy if exists "Check-in Map can read locations" on public.checkin_map_locations;
drop policy if exists "Check-in Map can create locations" on public.checkin_map_locations;
drop policy if exists "Check-in Map can update locations" on public.checkin_map_locations;
drop policy if exists "Check-in Map can delete locations" on public.checkin_map_locations;
create policy "Check-in Map can read locations" on public.checkin_map_locations for select to anon using (true);
create policy "Check-in Map can create locations" on public.checkin_map_locations for insert to anon with check (true);
create policy "Check-in Map can update locations" on public.checkin_map_locations for update to anon using (true) with check (true);
create policy "Check-in Map can delete locations" on public.checkin_map_locations for delete to anon using (true);

drop policy if exists "Check-in Map can read media" on public.checkin_map_media;
drop policy if exists "Check-in Map can create media" on public.checkin_map_media;
drop policy if exists "Check-in Map can delete media" on public.checkin_map_media;
create policy "Check-in Map can read media" on public.checkin_map_media for select to anon using (true);
create policy "Check-in Map can create media" on public.checkin_map_media for insert to anon with check (true);
create policy "Check-in Map can delete media" on public.checkin_map_media for delete to anon using (true);

insert into storage.buckets (id, name, public)
values ('checkin-map-media', 'checkin-map-media', true)
on conflict (id) do update set public = true;

drop policy if exists "Check-in Map can read stored media" on storage.objects;
drop policy if exists "Check-in Map can upload stored media" on storage.objects;
drop policy if exists "Check-in Map can delete stored media" on storage.objects;
create policy "Check-in Map can read stored media" on storage.objects for select to anon using (bucket_id = 'checkin-map-media');
create policy "Check-in Map can upload stored media" on storage.objects for insert to anon with check (bucket_id = 'checkin-map-media');
create policy "Check-in Map can delete stored media" on storage.objects for delete to anon using (bucket_id = 'checkin-map-media');

notify pgrst, 'reload schema';
