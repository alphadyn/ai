-- Pulse news aggregator — Supabase (Postgres) schema.
--
-- Pulse is a fully static site: the browser talks directly to Supabase using
-- the public "anon" key (see supabase-config.js) — there is no custom
-- backend server. All authentication is handled by Supabase Auth, and all
-- authorization (who can read/write/delete what) is enforced here in
-- Postgres via Row Level Security. Run this whole file once in the Supabase
-- SQL editor for your project before using the app.
--
-- IMPORTANT one-time manual step after running this file:
--   Authentication -> Providers -> Email -> turn OFF "Confirm email".
--   Pulse signs users up with a synthetic "username@pulse.local" address
--   (so people don't need a real inbox), which can never receive a real
--   confirmation link. Leaving "Confirm email" on will lock everyone out.
--
-- This script is safe to re-run: it drops any earlier Pulse tables/functions
-- first (e.g. from an older draft of this schema with text-based ids) so
-- types can never mismatch between a stale table and a freshly created one.
-- Re-running it deletes all existing Pulse data in this project.

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.enforce_profile_role_immutable() cascade;
drop function if exists public.enforce_post_delete_rules() cascade;
drop function if exists public.cast_post_vote(uuid, text, int) cascade;
drop function if exists public.cast_comment_vote(uuid, text, int) cascade;
drop function if exists public.cast_post_vote(text, text, int) cascade;
drop function if exists public.cast_comment_vote(text, text, int) cascade;

drop table if exists comment_votes cascade;
drop table if exists comments cascade;
drop table if exists post_votes cascade;
drop table if exists posts cascade;
drop table if exists profiles cascade;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profiles: public-facing user info, one row per Supabase Auth user.
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  avatar_data_url text check (avatar_data_url is null or char_length(avatar_data_url) <= 400000),
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever someone signs up via Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper used throughout RLS policies below.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Prevent privilege escalation: only an admin (acting on someone else's row)
-- may change a profile's role. A user updating their own avatar cannot also
-- sneak in role = 'admin'. auth.uid() is null for direct SQL (e.g. the
-- Supabase SQL editor, used to bootstrap the first admin per the README) —
-- only PostgREST-mediated requests carry a JWT, so that's the case this
-- rule needs to restrict; direct SQL access is already a trusted context.
create or replace function public.enforce_profile_role_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_role_guard on profiles;
create trigger profiles_role_guard
  before update on profiles
  for each row execute function public.enforce_profile_role_immutable();

-- ---------------------------------------------------------------------------
-- Posts
-- ---------------------------------------------------------------------------
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users(id) on delete set null,
  author_name text not null default 'Anonymous',
  title text not null check (char_length(title) between 1 and 300),
  body text default '',
  link_url text check (link_url is null or char_length(link_url) <= 2000),
  tags jsonb not null default '[]' check (jsonb_typeof(tags) = 'array' and jsonb_array_length(tags) <= 12),
  attachments jsonb not null default '[]' check (jsonb_typeof(attachments) = 'array'),
  upvotes integer not null default 0,
  downvotes integer not null default 0,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_posts_created on posts(created_at);

-- Only an admin may restore a deleted post; the owner (or an admin) may
-- soft-delete it. All other columns may only be changed by the owner/admin
-- (enforced by the RLS update policy below); this trigger adds the
-- restore-is-admin-only business rule on top of that.
create or replace function public.enforce_post_delete_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_deleted is distinct from old.is_deleted then
    if new.is_deleted = true then
      if not (old.author_id = auth.uid() or public.is_admin()) then
        raise exception 'Not authorized to delete this post.';
      end if;
    else
      if not public.is_admin() then
        raise exception 'Admin access required to restore a post.';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists posts_delete_guard on posts;
create trigger posts_delete_guard
  before update on posts
  for each row execute function public.enforce_post_delete_rules();

-- ---------------------------------------------------------------------------
-- Post votes (mutated only via the cast_post_vote() RPC below)
-- ---------------------------------------------------------------------------
create table if not exists post_votes (
  post_id uuid not null references posts(id) on delete cascade,
  voter_key text not null,
  value integer not null check (value in (-1, 1)),
  primary key (post_id, voter_key)
);

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  parent_id uuid references comments(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author_name text not null default 'Anonymous',
  body text default '',
  attachments jsonb not null default '[]' check (jsonb_typeof(attachments) = 'array'),
  upvotes integer not null default 0,
  downvotes integer not null default 0,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_comments_post on comments(post_id);
create index if not exists idx_comments_parent on comments(parent_id);

-- ---------------------------------------------------------------------------
-- Comment votes (mutated only via the cast_comment_vote() RPC below)
-- ---------------------------------------------------------------------------
create table if not exists comment_votes (
  comment_id uuid not null references comments(id) on delete cascade,
  voter_key text not null,
  value integer not null check (value in (-1, 1)),
  primary key (comment_id, voter_key)
);

-- ---------------------------------------------------------------------------
-- Vote RPCs: SECURITY DEFINER so the aggregate upvotes/downvotes columns can
-- never be tampered with directly by a client — only this controlled,
-- server-side (Postgres-side) logic can change them.
-- ---------------------------------------------------------------------------
create or replace function public.cast_post_vote(p_post_id uuid, p_voter_key text, p_value int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_value int := case when p_value > 0 then 1 when p_value < 0 then -1 else 0 end;
  v_old int;
begin
  select value into v_old from post_votes where post_id = p_post_id and voter_key = p_voter_key;
  if v_old is not null then
    if v_old = 1 then update posts set upvotes = upvotes - 1 where id = p_post_id; end if;
    if v_old = -1 then update posts set downvotes = downvotes - 1 where id = p_post_id; end if;
    delete from post_votes where post_id = p_post_id and voter_key = p_voter_key;
  end if;
  if v_value <> 0 then
    insert into post_votes (post_id, voter_key, value) values (p_post_id, p_voter_key, v_value);
    if v_value = 1 then
      update posts set upvotes = upvotes + 1 where id = p_post_id;
    else
      update posts set downvotes = downvotes + 1 where id = p_post_id;
    end if;
  end if;
end;
$$;

grant execute on function public.cast_post_vote(uuid, text, int) to anon, authenticated;

create or replace function public.cast_comment_vote(p_comment_id uuid, p_voter_key text, p_value int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_value int := case when p_value > 0 then 1 when p_value < 0 then -1 else 0 end;
  v_old int;
begin
  select value into v_old from comment_votes where comment_id = p_comment_id and voter_key = p_voter_key;
  if v_old is not null then
    if v_old = 1 then update comments set upvotes = upvotes - 1 where id = p_comment_id; end if;
    if v_old = -1 then update comments set downvotes = downvotes - 1 where id = p_comment_id; end if;
    delete from comment_votes where comment_id = p_comment_id and voter_key = p_voter_key;
  end if;
  if v_value <> 0 then
    insert into comment_votes (comment_id, voter_key, value) values (p_comment_id, p_voter_key, v_value);
    if v_value = 1 then
      update comments set upvotes = upvotes + 1 where id = p_comment_id;
    else
      update comments set downvotes = downvotes + 1 where id = p_comment_id;
    end if;
  end if;
end;
$$;

grant execute on function public.cast_comment_vote(uuid, text, int) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table posts enable row level security;
alter table post_votes enable row level security;
alter table comments enable row level security;
alter table comment_votes enable row level security;

-- profiles: usernames/avatars/roles are public info (needed to show author
-- badges on every post/comment), like a forum member list.
drop policy if exists "profiles are publicly readable" on profiles;
create policy "profiles are publicly readable" on profiles for select using (true);

drop policy if exists "users can update own profile" on profiles;
create policy "users can update own profile" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "admins can update any profile" on profiles;
create policy "admins can update any profile" on profiles
  for update using (public.is_admin());

-- posts: anyone can read non-deleted posts; admins can also see deleted ones.
drop policy if exists "posts are publicly readable" on posts;
create policy "posts are publicly readable" on posts
  for select using (is_deleted = false or public.is_admin());

drop policy if exists "anyone can create posts" on posts;
create policy "anyone can create posts" on posts
  for insert with check (author_id is null or author_id = auth.uid());

drop policy if exists "owner or admin can update posts" on posts;
create policy "owner or admin can update posts" on posts
  for update using (author_id = auth.uid() or public.is_admin());

-- post_votes: publicly readable (needed for "my vote" indicator); no direct
-- insert/update/delete policies — all mutation must go through the
-- cast_post_vote() RPC above, which bypasses RLS as SECURITY DEFINER.
drop policy if exists "post votes are publicly readable" on post_votes;
create policy "post votes are publicly readable" on post_votes for select using (true);

-- comments: publicly readable; deleted ones are hidden client-side.
drop policy if exists "comments are publicly readable" on comments;
create policy "comments are publicly readable" on comments for select using (true);

drop policy if exists "anyone can create comments" on comments;
create policy "anyone can create comments" on comments
  for insert with check (author_id is null or author_id = auth.uid());

drop policy if exists "owner or admin can update comments" on comments;
create policy "owner or admin can update comments" on comments
  for update using (author_id = auth.uid() or public.is_admin());

-- comment_votes: same pattern as post_votes.
drop policy if exists "comment votes are publicly readable" on comment_votes;
create policy "comment votes are publicly readable" on comment_votes for select using (true);
