-- Market Lens — shared ranked-watchlist cache (Supabase/Postgres).
--
-- The browser talks directly to Supabase using the public "anon" key (see
-- SUPABASE_URL / SUPABASE_ANON_KEY in app.js) — there is no custom backend.
-- This single-row table holds the last completed scan's results so every
-- visitor sees the same saved data on load instead of rescanning the market;
-- the refresh button overwrites this row with a fresh scan.
--
-- Run this whole file once in the Supabase SQL editor for your project.

drop table if exists public.sp500_watchlist_cache;

create table public.sp500_watchlist_cache (
  id text primary key default 'latest',
  results jsonb not null,
  selected_symbol text,
  watchlist jsonb,
  updated_at timestamptz not null default now()
);

alter table public.sp500_watchlist_cache enable row level security;

-- Anyone can read the cached scan (it's public market data, not user data).
create policy "sp500_cache_select" on public.sp500_watchlist_cache
  for select using (true);

-- Anyone can refresh the single cached row; there's no per-user data to protect.
create policy "sp500_cache_upsert" on public.sp500_watchlist_cache
  for insert with check (id = 'latest');

create policy "sp500_cache_update" on public.sp500_watchlist_cache
  for update using (id = 'latest') with check (id = 'latest');
