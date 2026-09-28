-- Private Analytics ingestion table. Run once in the new Supabase project's SQL editor.
-- Keep Row Level Security enabled and do not add anon/authenticated policies.
create table if not exists public.traffic_events (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null,
  timestamp timestamptz not null default now(),
  ip text not null default 'Not recorded',
  location text not null default 'Not recorded' check (length(location) <= 255),
  path text not null check (length(path) <= 500),
  page text not null check (length(page) between 1 and 160),
  referrer text not null default 'Direct' check (length(referrer) <= 255),
  referrer_url text check (referrer_url is null or length(referrer_url) <= 500),
  device text not null check (device in ('Desktop', 'Mobile', 'Tablet')),
  status integer check (status is null or status between 100 and 599),
  session_seconds integer check (session_seconds is null or session_seconds between 0 and 86400),
  bounced boolean
);

-- Also run this migration on existing tables before deploying the updated API.
alter table public.traffic_events drop constraint if exists traffic_events_masked_ip;
alter table public.traffic_events add column if not exists location text not null default 'Not recorded' check (length(location) <= 255);

create index if not exists traffic_events_visitor_id on public.traffic_events (visitor_id);

create index if not exists traffic_events_timestamp_desc on public.traffic_events (timestamp desc);
create index if not exists traffic_events_path_timestamp_desc on public.traffic_events (path, timestamp desc);
alter table public.traffic_events enable row level security;
revoke all on public.traffic_events from anon, authenticated;
grant select, insert on public.traffic_events to service_role;

-- Optional cleanup query for a scheduled database job; adjust retention as required.
-- delete from public.traffic_events where timestamp < now() - interval '90 days';
