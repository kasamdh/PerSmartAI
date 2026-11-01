-- Admin powers need a two-step (aal2) session. Run with: npx supabase test db

begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email) values
  ('3f000000-0000-4000-8000-0000000000a1', 'admin@mfa.test'),
  ('3f000000-0000-4000-8000-0000000000c1', 'owner@mfa.test');
insert into public.organizations (id, name, timezone) values
  ('3f000000-0000-4000-8000-000000000001', 'MFA Org', 'America/New_York');
insert into public.profiles (id, organization_id, role, full_name) values
  ('3f000000-0000-4000-8000-0000000000a1', '3f000000-0000-4000-8000-000000000001', 'admin', 'Admin'),
  ('3f000000-0000-4000-8000-0000000000c1', '3f000000-0000-4000-8000-000000000001', 'owner', 'Owner');
insert into public.households (id, organization_id, owner_id, address_line1, city) values
  ('3f000000-0000-4000-8000-0000000000d1', '3f000000-0000-4000-8000-000000000001',
   '3f000000-0000-4000-8000-0000000000c1', '1 Secret St', 'Town');
insert into public.household_access (organization_id, household_id, entry_instructions) values
  ('3f000000-0000-4000-8000-000000000001', '3f000000-0000-4000-8000-0000000000d1', 'Code 1234');

create function pg_temp.sign_in(p_user_id uuid, p_aal text) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', p_aal)::text, true);
$$;

-- Password only (aal1): no admin powers.
select pg_temp.sign_in('3f000000-0000-4000-8000-0000000000a1', 'aal1');
set local role authenticated;
select ok(not private.is_admin(), 'an admin signed in with only a password is not an admin');
select is_empty($$ select 1 from public.households $$, 'they can''t read clients'' addresses');
select is_empty($$ select 1 from public.household_access $$, 'or entry codes');
select is_empty($$ select 1 from public.invites $$, 'or invite codes');
select throws_ok(
  $$ insert into public.invites (role) values ('owner') $$,
  null, null,
  'and can''t invite anyone'
);
select is(
  (select role::text from public.profiles where id = '3f000000-0000-4000-8000-0000000000a1'),
  'admin',
  'but can read their own profile, so the app can ask for the second step'
);
reset role;

-- Two-step session (aal2): full admin.
select pg_temp.sign_in('3f000000-0000-4000-8000-0000000000a1', 'aal2');
set local role authenticated;
select ok(private.is_admin(), 'after the second step they are an admin');
select is(
  (select entry_instructions from public.household_access),
  'Code 1234',
  'and can see their business''s clients'
);
reset role;

-- Owners don't need two-step sign-in.
select pg_temp.sign_in('3f000000-0000-4000-8000-0000000000c1', 'aal1');
set local role authenticated;
select is(
  (select count(*)::int from public.households),
  1,
  'owners use the app with a password as before'
);
reset role;

select * from finish();
rollback;
