-- Business admins must use two-step sign-in (TOTP authenticator app).
--
-- Every admin privilege (RLS policies, guard triggers, scheduling RPCs, storage
-- rules) goes through private.is_admin(). It now also requires the session to be
-- verified with a second factor (JWT claim aal = 'aal2'). An admin signed in with
-- only a password is treated like any other member: they can read their own
-- profile and business, which the apps use to send them to the two-step screen,
-- and nothing else. So a stolen admin password alone can't reach client data.

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_app_role() = 'admin', false)
     and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
$$;
