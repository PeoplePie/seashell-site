-- Seashell: tighten what the browser (anon) may write. Review of 28 Oct 2026, finding "traction can be faked".
-- 1. Column-level INSERT: the public key can no longer set id or created_at (no back-dated sign-ups).
-- 2. Size limits: one request cannot store megabytes. js/store.js truncates to fit these.
-- 3. traction_daily leaves out test visits (?utm_source=test, props.test, +test@ and .invalid emails).
-- Applied by the Supabase GitHub integration when website/deploy.py pushes it to supabase/migrations/.
-- Safe to run twice.

revoke insert on public.waitlist from anon;
revoke insert on public.events   from anon;
grant insert (email, source, path, referrer, user_agent, consent_at, utm) on public.waitlist to anon;
grant insert (name, props, session_id, path, referrer, user_agent)        on public.events   to anon;

alter table public.waitlist drop constraint if exists waitlist_sizes;
alter table public.waitlist add constraint waitlist_sizes check (
      coalesce(length(source), 0)     <= 64
  and coalesce(length(path), 0)       <= 512
  and coalesce(length(referrer), 0)   <= 1024
  and coalesce(length(user_agent), 0) <= 512
  and coalesce(pg_column_size(utm), 0) <= 2048
);

alter table public.events drop constraint if exists events_sizes;
alter table public.events add constraint events_sizes check (
      coalesce(length(session_id), 0) <= 64
  and coalesce(length(path), 0)       <= 512
  and coalesce(length(referrer), 0)   <= 1024
  and coalesce(length(user_agent), 0) <= 512
  and coalesce(pg_column_size(props), 0) <= 4096
);

-- 3. The daily view without test traffic (same columns, so create or replace works).
create or replace view public.traction_daily as
select d::date as day,
       (select count(*) from public.events e  where e.name = 'page_view' and e.created_at::date = d::date
          and coalesce(e.props->>'test', 'false') <> 'true' and coalesce(e.props->'utm'->>'utm_source', '') <> 'test') as page_views,
       (select count(*) from public.events e  where e.name = 'buy_click' and e.created_at::date = d::date
          and coalesce(e.props->>'test', 'false') <> 'true' and coalesce(e.props->'utm'->>'utm_source', '') <> 'test') as buy_clicks,
       (select count(*) from public.waitlist w where w.created_at::date = d::date
          and coalesce(w.utm->>'utm_source', '') <> 'test' and w.email not like '%+test@%' and w.email not like '%.invalid') as signups
from generate_series(date '2026-10-28', current_date, interval '1 day') as d;
revoke all on public.traction_daily from anon, authenticated;
