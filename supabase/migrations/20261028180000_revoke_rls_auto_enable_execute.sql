-- Security advisor 0028/0029 (28 Oct 2026): public.rls_auto_enable() is Supabase's event-trigger helper that
-- turns on RLS for every new public table. It is SECURITY DEFINER and was executable by anon/authenticated
-- through /rest/v1/rpc. Event triggers fire without an EXECUTE check, so revoking it changes nothing for the
-- trigger and closes the API route.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
