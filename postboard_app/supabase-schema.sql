create table if not exists public.posts (
  id text primary key,
  person_name text not null,
  user_name text not null,
  message text not null,
  post_date date not null,
  post_time time not null,
  location text not null default '',
  attachment jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.posts enable row level security;

drop policy if exists "Postboard can read posts" on public.posts;
drop policy if exists "Postboard can create posts" on public.posts;
drop policy if exists "Postboard can update posts" on public.posts;
drop policy if exists "Postboard can delete posts" on public.posts;

create policy "Postboard can read posts"
  on public.posts for select
  to anon
  using (true);

create policy "Postboard can create posts"
  on public.posts for insert
  to anon
  with check (true);

create policy "Postboard can update posts"
  on public.posts for update
  to anon
  using (true)
  with check (true);

create policy "Postboard can delete posts"
  on public.posts for delete
  to anon
  using (true);

notify pgrst, 'reload schema';