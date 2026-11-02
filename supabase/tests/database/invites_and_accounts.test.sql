-- Invites, sign-up profile creation, and account deletion. Run: npx supabase test db

begin;

create extension if not exists pgtap with schema extensions;

select plan(19);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('d0000000-0000-4000-8000-0000000000a1', 'admin@inv.test'),
  ('d0000000-0000-4000-8000-0000000000a2', 'other-admin@inv.test'),
  ('d0000000-0000-4000-8000-0000000000c1', 'owner@inv.test'),
  ('d0000000-0000-4000-8000-0000000000b1', 'sitter@inv.test');

insert into public.organizations (id, name, timezone) values
  ('d0000000-0000-4000-8000-000000000001', 'Invite Org', 'America/Chicago'),
  ('d0000000-0000-4000-8000-000000000002', 'Other Org', 'UTC');

insert into public.profiles (id, organization_id, role, full_name) values
  ('d0000000-0000-4000-8000-0000000000a1', 'd0000000-0000-4000-8000-000000000001', 'admin', 'Admin'),
  ('d0000000-0000-4000-8000-0000000000c1', 'd0000000-0000-4000-8000-000000000001', 'owner', 'Owner'),
  ('d0000000-0000-4000-8000-0000000000b1', 'd0000000-0000-4000-8000-000000000001', 'sitter', 'Sitter'),
  ('d0000000-0000-4000-8000-0000000000a2', 'd0000000-0000-4000-8000-000000000002', 'admin', 'Other Admin');

insert into public.invites (id, organization_id, role, email, code, expires_at, created_by) values
  ('d0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-000000000001', 'owner', null, 'OWNRCODE', now() + interval '1 day', 'd0000000-0000-4000-8000-0000000000a1'),
  ('d0000000-0000-4000-8000-0000000000f2', 'd0000000-0000-4000-8000-000000000001', 'sitter', null, 'XPRDCODE', now() - interval '1 minute', 'd0000000-0000-4000-8000-0000000000a1'),
  ('d0000000-0000-4000-8000-0000000000f3', 'd0000000-0000-4000-8000-000000000001', 'sitter', 'locked@inv.test', 'LCKDCODE', now() + interval '1 day', 'd0000000-0000-4000-8000-0000000000a1');

-- Owner household with a visit the sitter logged care on (for deletion tests).
insert into public.households (id, organization_id, owner_id, address_line1, city) values
  ('d0000000-0000-4000-8000-0000000000d1', 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-0000000000c1', '1 Elm', 'Town');
insert into public.pets (id, organization_id, household_id, name, species) values
  ('d0000000-0000-4000-8000-0000000000e1', 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-0000000000d1', 'Pip', 'dog');
insert into public.bookings (id, organization_id, household_id, sitter_id, service_type, start_date, status) values
  ('d0000000-0000-4000-8000-0000000000b9', 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-0000000000d1', 'd0000000-0000-4000-8000-0000000000b1', 'walk', current_date, 'confirmed');
insert into public.booking_pets (organization_id, booking_id, pet_id) values
  ('d0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-0000000000b9', 'd0000000-0000-4000-8000-0000000000e1');
insert into public.visits (id, organization_id, booking_id, sitter_id, scheduled_start, scheduled_end) values
  ('d0000000-0000-4000-8000-000000000101', 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-0000000000b9', 'd0000000-0000-4000-8000-0000000000b1', now(), now() + interval '30 minutes');
insert into public.care_events (id, organization_id, visit_id, pet_id, type, created_by) values
  ('d0000000-0000-4000-8000-000000000201', 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000101', 'd0000000-0000-4000-8000-0000000000e1', 'pee', 'd0000000-0000-4000-8000-0000000000b1');

create function pg_temp.sign_in(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
$$;

-- ---------------------------------------------------------------------------
-- Invite codes and access
-- ---------------------------------------------------------------------------

select matches(private.generate_invite_code(), '^[A-HJKMNP-Z2-9]{8}$', 'invite codes are 8 unambiguous characters');

select pg_temp.sign_in('d0000000-0000-4000-8000-0000000000a1');
set local role authenticated;
select lives_ok(
  $$ insert into public.invites (role, email) values ('sitter', 'new.sitter@inv.test') $$,
  'admins can create invites (org and code filled in automatically)'
);
reset role;

select pg_temp.sign_in('d0000000-0000-4000-8000-0000000000c1');
set local role authenticated;
select is_empty($$ select 1 from public.invites $$, 'owners cannot read invites');
select throws_ok(
  $$ insert into public.invites (role) values ('sitter') $$,
  '42501', null,
  'owners cannot create invites'
);
reset role;

select pg_temp.sign_in('d0000000-0000-4000-8000-0000000000a2');
set local role authenticated;
select is_empty($$ select 1 from public.invites $$, 'admins of another business cannot read invites');
reset role;

set local role anon;
select results_eq(
  $$ select organization_name, role::text, email_locked from public.check_invite('ownr-code') $$,
  $$ values ('Invite Org', 'owner', false) $$,
  'anyone can look up a valid code (case and dashes ignored), seeing only business name and role'
);
select is_empty($$ select 1 from public.check_invite('XPRDCODE') $$, 'expired codes look invalid');
select throws_ok($$ select * from public.invites $$, '42501', null, 'anon has no access to the invites table at all');
reset role;

-- ---------------------------------------------------------------------------
-- Sign-up creates profiles
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data) values
  ('d0000000-0000-4000-8000-0000000000c9', 'joiner@inv.test',
   '{"invite_code": "ownr-code", "full_name": "Jo Iner", "phone": "+15550001"}');

select results_eq(
  $$ select organization_id, role::text, full_name, phone from public.profiles
     where id = 'd0000000-0000-4000-8000-0000000000c9' $$,
  $$ values ('d0000000-0000-4000-8000-000000000001'::uuid, 'owner', 'Jo Iner', '+15550001') $$,
  'signing up with an invite code creates a profile in that business with that role'
);

select isnt(
  (select accepted_at from public.invites where id = 'd0000000-0000-4000-8000-0000000000f1'),
  null,
  'the invite is marked accepted'
);

select throws_ok(
  $$ insert into auth.users (id, email, raw_user_meta_data)
     values (gen_random_uuid(), 'second@inv.test', '{"invite_code": "OWNRCODE"}') $$,
  'P0001', null,
  'an invite code works only once'
);

select throws_ok(
  $$ insert into auth.users (id, email, raw_user_meta_data)
     values (gen_random_uuid(), 'late@inv.test', '{"invite_code": "XPRDCODE"}') $$,
  'P0001', null,
  'expired invite codes are rejected'
);

select throws_ok(
  $$ insert into auth.users (id, email, raw_user_meta_data)
     values (gen_random_uuid(), 'someone.else@inv.test', '{"invite_code": "LCKDCODE"}') $$,
  'P0001', null,
  'email-locked invites reject other email addresses'
);

insert into auth.users (id, email, raw_user_meta_data) values
  ('d0000000-0000-4000-8000-0000000000a9', 'founder@inv.test',
   '{"signup_type": "business", "business_name": "Paw Patrol LLC", "timezone": "America/Denver", "full_name": "Fran Founder"}');

select results_eq(
  $$ select o.name, o.timezone, p.role::text, p.full_name
     from public.profiles p join public.organizations o on o.id = p.organization_id
     where p.id = 'd0000000-0000-4000-8000-0000000000a9' $$,
  $$ values ('Paw Patrol LLC', 'America/Denver', 'admin', 'Fran Founder') $$,
  'business sign-up creates the organization and makes the founder its admin'
);

select throws_ok(
  $$ insert into auth.users (id, email, raw_user_meta_data)
     values (gen_random_uuid(), 'tz@inv.test', '{"signup_type": "business", "business_name": "X", "timezone": "Mars/Base"}') $$,
  '22023', null,
  'business sign-up rejects unknown time zones'
);

insert into auth.users (id, email) values ('d0000000-0000-4000-8000-0000000000e9', 'plain@inv.test');
select is_empty(
  $$ select 1 from public.profiles where id = 'd0000000-0000-4000-8000-0000000000e9' $$,
  'a plain sign-up (no invite, no business) gets no profile'
);

-- ---------------------------------------------------------------------------
-- Account deletion
-- ---------------------------------------------------------------------------

delete from auth.users where id = 'd0000000-0000-4000-8000-0000000000b1';
select results_eq(
  $$ select v.sitter_id, ce.created_by
     from public.visits v join public.care_events ce on ce.visit_id = v.id
     where v.id = 'd0000000-0000-4000-8000-000000000101' $$,
  $$ values (null::uuid, null::uuid) $$,
  'deleting a sitter keeps the visit and its care log, detached from them'
);

delete from auth.users where id = 'd0000000-0000-4000-8000-0000000000c1';
select is_empty(
  $$ select 1 from public.households where id = 'd0000000-0000-4000-8000-0000000000d1'
     union all select 1 from public.pets where id = 'd0000000-0000-4000-8000-0000000000e1'
     union all select 1 from public.visits where id = 'd0000000-0000-4000-8000-000000000101'
     union all select 1 from public.care_events where id = 'd0000000-0000-4000-8000-000000000201' $$,
  'deleting an owner removes their household, pets, visits, and care logs'
);

select throws_ok(
  $$ insert into public.care_events (organization_id, visit_id, type, created_by)
     select organization_id, id, 'note', null from public.visits limit 1 $$,
  '23502', null,
  'new care events must still name an author'
);

select * from finish();
rollback;
