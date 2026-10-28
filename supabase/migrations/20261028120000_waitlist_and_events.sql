-- Seashell pre-launch: waitlist sign-ups + traction events.
-- The website uses the publishable (anon) key and may only INSERT. Nobody but the dashboard /
-- service role can read. Inserts must send `Prefer: return=minimal` (anon has no SELECT).

create table if not exists public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  email       text not null,
  source      text,                 -- where on the page: 'buy_now_modal', 'footer', ...
  path        text,
  referrer    text,
  user_agent  text,
  consent_at  timestamptz,          -- when the person ticked "keep me posted"
  utm         jsonb,                -- utm_source / utm_medium / utm_campaign from the URL
  constraint waitlist_email_format check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' and length(email) <= 254),
  constraint waitlist_email_unique unique (email)   -- a second sign-up answers 409: "already on the list"
);

create table if not exists public.events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  name        text not null check (name in ('page_view', 'cta_view', 'buy_click', 'waitlist_submit', 'waitlist_error')),
  props       jsonb,                -- e.g. {"section": "hero", "price": 199}
  session_id  text,                 -- random id per browser session, no cookies needed
  path        text,
  referrer    text,
  user_agent  text
);
create index if not exists events_name_created_idx on public.events (name, created_at desc);

alter table public.waitlist enable row level security;
alter table public.events   enable row level security;

drop policy if exists "anon can join the waitlist" on public.waitlist;
create policy "anon can join the waitlist" on public.waitlist for insert to anon with check (true);
drop policy if exists "anon can log events" on public.events;
create policy "anon can log events" on public.events for insert to anon with check (true);

-- Supabase grants anon/authenticated ALL on new tables by default: keep only INSERT for the site.
revoke all on public.waitlist from anon, authenticated;
revoke all on public.events   from anon, authenticated;
grant insert on public.waitlist to anon;
grant insert on public.events   to anon;

-- Pau's traction view (read it in the dashboard; it is hidden from the browser roles).
create or replace view public.traction_daily as
select d::date as day,
       (select count(*) from public.events e  where e.name = 'page_view' and e.created_at::date = d::date) as page_views,
       (select count(*) from public.events e  where e.name = 'buy_click' and e.created_at::date = d::date) as buy_clicks,
       (select count(*) from public.waitlist w where w.created_at::date = d::date)                          as signups
from generate_series(date '2026-10-28', current_date, interval '1 day') as d;
revoke all on public.traction_daily from anon, authenticated;
