-- Seashell: the funnel in people, not events (2 Nov 2026, after Pau asked what else Supabase should track).
-- traction_counts() counts events: a visitor who opens the waitlist window twice counts twice. This function counts
-- distinct browser sessions per step, per UTC day and per campaign tag, so the Thursday page can say "of N people who
-- landed, M scrolled to half, K opened the waitlist, J signed up". Steps: page_view; scroll_50 (a scroll event of 50 %
-- or deeper); dwell_10 (10 s or 30 s on the page); waitlist_open (waitlist_open, or buy_click before 2 Nov, when that
-- was the name of the same action); waitlist_focus; waitlist_submit; waitlist_error; signup (the waitlist table, by the
-- session id stored in its utm). Counts only: no email, no session id, no browser string leaves the database.
-- Additive: nothing dropped or changed. Safe to run twice. Applied through the Supabase connector on 2 Nov 2026.

create or replace function public.traction_sessions()
returns table (day date, utm_source text, utm_medium text, utm_campaign text, utm_content text, place text,
               lang2 text, is_test boolean, step text, sessions bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with e as (
    select (created_at at time zone 'UTC')::date as day,
           left(props->'utm'->>'utm_source', 60) as utm_source, left(props->'utm'->>'utm_medium', 60) as utm_medium,
           left(props->'utm'->>'utm_campaign', 60) as utm_campaign, left(props->'utm'->>'utm_content', 60) as utm_content,
           left(props->'utm'->>'place', 60) as place, lower(left(props->>'lang', 2)) as lang2,
           (coalesce(props->>'test', 'false') = 'true'
            or lower(coalesce(props->'utm'->>'utm_source', '')) in ('test', 'review')) as is_test,
           session_id,
           case when name = 'page_view' then 'page_view'
                when name = 'scroll' and coalesce((props->>'depth')::int, 0) >= 50 then 'scroll_50'
                when name = 'dwell' and coalesce((props->>'seconds')::int, 0) >= 10 then 'dwell_10'
                when name = 'waitlist_open' then 'waitlist_open'
                when name = 'buy_click' and created_at < timestamptz '2026-11-02 00:00+00' then 'waitlist_open'
                when name in ('waitlist_focus', 'waitlist_submit', 'waitlist_error') then name
                else null end as step
    from public.events
    where session_id is not null
  )
  select day, utm_source, utm_medium, utm_campaign, utm_content, place, lang2, is_test, step, count(distinct session_id)
  from e where step is not null
  group by 1, 2, 3, 4, 5, 6, 7, 8, 9
  union all
  select (w.created_at at time zone 'UTC')::date,
         left(w.utm->>'utm_source', 60), left(w.utm->>'utm_medium', 60), left(w.utm->>'utm_campaign', 60),
         left(w.utm->>'utm_content', 60), left(w.utm->>'place', 60), lower(left(w.utm->>'lang', 2)),
         (lower(coalesce(w.utm->>'utm_source', '')) in ('test', 'review')
          or w.email like '%+test@%' or lower(w.email) like 'test+%' or w.email like '%.invalid'),
         'signup', count(distinct coalesce(w.utm->>'session_id', w.email))
  from public.waitlist w
  group by 1, 2, 3, 4, 5, 6, 7, 8
  order by 1, 9;
$$;

revoke all on function public.traction_sessions() from public, anon, authenticated;
grant execute on function public.traction_sessions() to anon, authenticated;
