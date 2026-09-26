-- Market Curve Lab — shared results cache (Supabase/Postgres).
--
-- The browser talks directly to Supabase using the public "anon" key (see
-- SUPABASE_URL / SUPABASE_ANON_KEY in static/app.js) — there is no custom
-- backend for this. This generic key/value table holds the last computed
-- S&P 500 ranking (id = 'companies') and the last computed analysis for each
-- ticker looked up (id = 'analysis:<SYMBOL>'), so page loads read saved
-- results instead of re-ranking the index and re-fetching price history
-- every time. The refresh button overwrites these rows with fresh data.
--
-- Run this whole file once in the Supabase SQL editor for your project.
-- This project reuses the same Supabase project as market_lens_app; only a
-- new table is needed here.

drop table if exists public.market_curve_lab_cache;

create table public.market_curve_lab_cache (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.market_curve_lab_cache enable row level security;

-- Anyone can read the cached results (it's public market data, not user data).
create policy "market_curve_lab_cache_select" on public.market_curve_lab_cache
  for select using (true);

-- Anyone can write a cached row; there's no per-user data to protect.
create policy "market_curve_lab_cache_insert" on public.market_curve_lab_cache
  for insert with check (true);

create policy "market_curve_lab_cache_update" on public.market_curve_lab_cache
  for update using (true) with check (true);
