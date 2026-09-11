create table if not exists public.media_items (
  id text primary key,
  title text not null,
  filename text not null,
  type text not null,
  mime_type text not null default 'application/octet-stream',
  size bigint not null default 0,
  date timestamptz not null default now(),
  category text not null default 'General',
  author text not null default 'Anonymous',
  status text not null default 'published',
  rating integer not null default 0,
  starred boolean not null default false,
  tags jsonb not null default '[]'::jsonb,
  description text not null default '',
  custom_props jsonb not null default '[]'::jsonb,
  data_url text,
  text_content text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists media_items_type_idx on public.media_items(type);
create index if not exists media_items_category_idx on public.media_items(category);
create index if not exists media_items_status_idx on public.media_items(status);
create index if not exists media_items_date_idx on public.media_items(date desc);
create index if not exists media_items_starred_idx on public.media_items(starred);

alter table public.media_items enable row level security;

drop policy if exists "Nexus CMS can read media items" on public.media_items;
drop policy if exists "Nexus CMS can create media items" on public.media_items;
drop policy if exists "Nexus CMS can update media items" on public.media_items;
drop policy if exists "Nexus CMS can delete media items" on public.media_items;

create policy "Nexus CMS can read media items"
  on public.media_items for select to anon using (true);
create policy "Nexus CMS can create media items"
  on public.media_items for insert to anon with check (true);
create policy "Nexus CMS can update media items"
  on public.media_items for update to anon using (true) with check (true);
create policy "Nexus CMS can delete media items"
  on public.media_items for delete to anon using (true);

notify pgrst, 'reload schema';
