-- Seashell: an aggregate traction readout the public (anon) key may call (recipe step 899b).
-- Applied to the live project on 29 Oct 2026 through the Supabase connector (apply_migration), so the
-- project's migration history already holds version 20261029150044: when deploy_v1.py / deploy.py push
-- this file to supabase/migrations/, the GitHub integration finds it applied and skips it.
-- The tables stay INSERT-only for the browser. This function returns counts per day, row kind, site tag,
-- utm_source / utm_medium / utm_campaign / utm_content and ?place=, never an email, session id, browser
-- or referrer. website/traction.py calls it through POST /rest/v1/rpc/traction_counts.
-- Days are UTC. is_test marks test traffic (?utm_source=test, props.test, +test@ and .invalid emails),
-- the same rule as the traction_daily view. Additive; running it twice changes nothing.
-- To close it again (additive, nothing dropped):
--   revoke execute on function public.traction_counts() from anon, authenticated;

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
         (coalesce(e.props->>'test', 'false') = 'true' or coalesce(e.props->'utm'->>'utm_source', '') = 'test'),
         count(*)
  from public.events e
  group by 1, 2, 3, 4, 5, 6, 7, 8, 9
  union all
  select (w.created_at at time zone 'UTC')::date, 'signup',
         left(w.utm->>'tag', 40),
         left(w.utm->>'utm_source', 60), left(w.utm->>'utm_medium', 60),
         left(w.utm->>'utm_campaign', 60), left(w.utm->>'utm_content', 60),
         left(w.utm->>'place', 60),
         (coalesce(w.utm->>'utm_source', '') = 'test' or w.email like '%+test@%' or w.email like '%.invalid'),
         count(*)
  from public.waitlist w
  group by 1, 2, 3, 4, 5, 6, 7, 8, 9
  order by 1, 2;
$$;

revoke all on function public.traction_counts() from public, anon, authenticated;
grant execute on function public.traction_counts() to anon, authenticated;
