-- Table is named "postboard_posts" (not "posts") because this Supabase
-- project is shared with other apps (e.g. news_aggregator_app) that already
-- have their own unrelated "posts" table. Using a distinct name avoids
-- accidentally reading/writing another app's data.
create table if not exists public.postboard_posts (
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

alter table public.postboard_posts enable row level security;

drop policy if exists "Postboard can read posts" on public.postboard_posts;
drop policy if exists "Postboard can create posts" on public.postboard_posts;
drop policy if exists "Postboard can update posts" on public.postboard_posts;
drop policy if exists "Postboard can delete posts" on public.postboard_posts;

create policy "Postboard can read posts"
  on public.postboard_posts for select
  to anon
  using (true);

create policy "Postboard can create posts"
  on public.postboard_posts for insert
  to anon
  with check (true);

create policy "Postboard can update posts"
  on public.postboard_posts for update
  to anon
  using (true)
  with check (true);

create policy "Postboard can delete posts"
  on public.postboard_posts for delete
  to anon
  using (true);

notify pgrst, 'reload schema';