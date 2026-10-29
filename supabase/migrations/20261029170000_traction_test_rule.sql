-- Seashell: widen the test-traffic rule (site-v1 review-v2, fix 6; recipe step 899c).
-- The review's own tracking run (?utm_source=review, test+review@sportseashell.com) passed as real traffic,
-- because the rule only knew ?utm_source=test, props.test, '+test@' and '.invalid' emails. Test traffic is now
-- also utm_source 'review' and any email that starts with 'test+' (the address every workflow test uses).
-- Replaces public.traction_counts() (same signature, same grants) and public.traction_daily (same columns).
-- Additive: no row is changed or deleted; running it twice changes nothing.
-- NOT applied by the step that wrote it. Apply it with the Supabase connector (apply_migration, project
-- hyylgliqpzvaykttkkko) before the next deploy, or let the deploy push it: deploy_v1.py copies new files from
-- website/db/migrations/ to supabase/migrations/ and the GitHub integration applies a version it has not seen.

create or replace function public.traction_counts()
returns table (day date, kind text, tag text, utm_source text, utm_medium text, utm_campaign text,
               utm_content text, place text, is_test boolean, n bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select (e.created_at at time zone 'UTC')::date, e.name,
         left(e.props->>'tag', 40),
         left(e.props->'utm'->>'utm_source', 60), left(e.props->'utm'->>'utm_medium', 60),
         left(e.props->'utm'->>'utm_campaign', 60), left(e.props->'utm'->>'utm_content', 60),
         left(e.props->'utm'->>'place', 60),
         (coalesce(e.props->>'test', 'false') = 'true'
          or lower(coalesce(e.props->'utm'->>'utm_source', '')) in ('test', 'review')),
         count(*)
  from public.events e
  group by 1, 2, 3, 4, 5, 6, 7, 8, 9
  union all
  select (w.created_at at time zone 'UTC')::date, 'signup',
         left(w.utm->>'tag', 40),
         left(w.utm->>'utm_source', 60), left(w.utm->>'utm_medium', 60),
         left(w.utm->>'utm_campaign', 60), left(w.utm->>'utm_content', 60),
         left(w.utm->>'place', 60),
         (lower(coalesce(w.utm->>'utm_source', '')) in ('test', 'review')
          or w.email like '%+test@%' or lower(w.email) like 'test+%' or w.email like '%.invalid'),
         count(*)
  from public.waitlist w
  group by 1, 2, 3, 4, 5, 6, 7, 8, 9
  order by 1, 2;
$$;

revoke all on function public.traction_counts() from public, anon, authenticated;
grant execute on function public.traction_counts() to anon, authenticated;

create or replace view public.traction_daily as
select d::date as day,
       (select count(*) from public.events e  where e.name = 'page_view' and e.created_at::date = d::date
          and coalesce(e.props->>'test', 'false') <> 'true'
          and lower(coalesce(e.props->'utm'->>'utm_source', '')) not in ('test', 'review')) as page_views,
       (select count(*) from public.events e  where e.name = 'buy_click' and e.created_at::date = d::date
          and coalesce(e.props->>'test', 'false') <> 'true'
          and lower(coalesce(e.props->'utm'->>'utm_source', '')) not in ('test', 'review')) as buy_clicks,
       (select count(*) from public.waitlist w where w.created_at::date = d::date
          and lower(coalesce(w.utm->>'utm_source', '')) not in ('test', 'review')
          and w.email not like '%+test@%' and lower(w.email) not like 'test+%' and w.email not like '%.invalid') as signups
from generate_series(date '2026-10-28', current_date, interval '1 day') as d;
revoke all on public.traction_daily from anon, authenticated;
