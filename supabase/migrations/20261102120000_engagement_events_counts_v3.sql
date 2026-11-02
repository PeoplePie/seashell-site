-- Seashell: engagement events and a wider counts function (2 Nov 2026, after the Meta test audit:
-- 2,556 paid page views, 0 sign-ups, and no event between the page view and the buy click to say where people left).
-- 1. The events table accepts the engagement names the site logs from 2 Nov: scroll (props.depth 25|50|75|100),
--    dwell (props.seconds 10|30), tab_click (props.tab), waitlist_open (props.section), waitlist_focus,
--    waitlist_close (props.typed), sheet_open, sheet_close. Additive: the five old names stay allowed.
-- 2. public.traction_counts() gains two columns, lang2 (the first two letters of the browser language, from
--    props.lang, or utm.lang on a waitlist row) and in_app (the Facebook or Instagram in-app browser, from the
--    user agent), and splits scroll and dwell by depth and seconds in `kind` (scroll_50, dwell_10), so the daily
--    readout can count page views per language and the funnel per step. The return type changes, so the old
--    function is dropped and re-created with the same grants. Still counts only: never an email, a session id,
--    a browser string or a referrer leaves the database.
-- Nothing is removed: no event, no column, no grant. Safe to run twice.
-- Applied through the Supabase connector on 2 Nov 2026; the GitHub integration then finds the version applied.

alter table public.events drop constraint if exists events_name_check;
alter table public.events add constraint events_name_check check (name in (
  'page_view', 'cta_view', 'buy_click', 'waitlist_submit', 'waitlist_error',
  'scroll', 'dwell', 'tab_click', 'waitlist_open', 'waitlist_focus', 'waitlist_close', 'sheet_open', 'sheet_close'));

drop function if exists public.traction_counts();
create function public.traction_counts()
returns table (day date, kind text, tag text, utm_source text, utm_medium text, utm_campaign text,
               utm_content text, place text, is_test boolean, n bigint, lang2 text, in_app boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select (e.created_at at time zone 'UTC')::date,
         case when e.name = 'scroll' then 'scroll_' || coalesce(e.props->>'depth', '')
              when e.name = 'dwell'  then 'dwell_'  || coalesce(e.props->>'seconds', '')
              else e.name end,
         left(e.props->>'tag', 40),
         left(e.props->'utm'->>'utm_source', 60), left(e.props->'utm'->>'utm_medium', 60),
         left(e.props->'utm'->>'utm_campaign', 60), left(e.props->'utm'->>'utm_content', 60),
         left(e.props->'utm'->>'place', 60),
         (coalesce(e.props->>'test', 'false') = 'true'
          or lower(coalesce(e.props->'utm'->>'utm_source', '')) in ('test', 'review')),
         count(*),
         lower(left(e.props->>'lang', 2)),
         (coalesce(e.user_agent, '') ~ '(FBAN|FBAV|FB_IAB|Instagram)')
  from public.events e
  group by 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12
  union all
  select (w.created_at at time zone 'UTC')::date, 'signup',
         left(w.utm->>'tag', 40),
         left(w.utm->>'utm_source', 60), left(w.utm->>'utm_medium', 60),
         left(w.utm->>'utm_campaign', 60), left(w.utm->>'utm_content', 60),
         left(w.utm->>'place', 60),
         (lower(coalesce(w.utm->>'utm_source', '')) in ('test', 'review')
          or w.email like '%+test@%' or lower(w.email) like 'test+%' or w.email like '%.invalid'),
         count(*),
         lower(left(w.utm->>'lang', 2)),
         (coalesce(w.user_agent, '') ~ '(FBAN|FBAV|FB_IAB|Instagram)')
  from public.waitlist w
  group by 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12
  order by 1, 2;
$$;

revoke all on function public.traction_counts() from public, anon, authenticated;
grant execute on function public.traction_counts() to anon, authenticated;
