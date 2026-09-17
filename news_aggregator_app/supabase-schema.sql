-- Pulse news aggregator — Supabase (Postgres) schema.
--
-- Run this once in the Supabase SQL editor for your project. It creates all
-- tables used by database_supabase.py and locks every table down with Row
-- Level Security enabled and NO policies defined for the anon/authenticated
-- roles. That means the public/anon API key CANNOT read or write any of
-- these tables (including password hashes and session tokens) even if it
-- were ever exposed client-side. Only the secret service_role key — used
-- exclusively by server.py, never sent to the browser — can access this
-- data, because the service role bypasses RLS entirely.
--
-- Do NOT add permissive policies here; all reads/writes must go through
-- the Pulse Python API, which enforces auth/ownership rules identically to
-- the local SQLite backend.

create extension if not exists pgcrypto;

create table if not exists users (
  id text primary key,
  username text unique not null,
  password_hash text not null,
  password_salt text not null,
  role text not null default 'user',
  avatar_data_url text,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  token_hash text primary key,
  user_id text not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists posts (
  id text primary key,
  author_id text references users(id) on delete set null,
  author_name text not null default 'Anonymous',
  title text not null,
  body text default '',
  link_url text,
  tags jsonb not null default '[]',
  attachments jsonb not null default '[]',
  upvotes integer not null default 0,
  downvotes integer not null default 0,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists post_votes (
  post_id text not null references posts(id) on delete cascade,
  voter_key text not null,
  value integer not null,
  primary key (post_id, voter_key)
);

create table if not exists comments (
  id text primary key,
  post_id text not null references posts(id) on delete cascade,
  parent_id text references comments(id) on delete cascade,
  author_id text references users(id) on delete set null,
  author_name text not null default 'Anonymous',
  body text default '',
  attachments jsonb not null default '[]',
  upvotes integer not null default 0,
  downvotes integer not null default 0,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists comment_votes (
  comment_id text not null references comments(id) on delete cascade,
  voter_key text not null,
  value integer not null,
  primary key (comment_id, voter_key)
);

create index if not exists idx_posts_created on posts(created_at);
create index if not exists idx_comments_post on comments(post_id);
create index if not exists idx_comments_parent on comments(parent_id);

alter table users enable row level security;
alter table sessions enable row level security;
alter table posts enable row level security;
alter table post_votes enable row level security;
alter table comments enable row level security;
alter table comment_votes enable row level security;
-- Intentionally no CREATE POLICY statements: default-deny for anon/authenticated.
-- server.py connects with the service_role key, which bypasses RLS by design.
