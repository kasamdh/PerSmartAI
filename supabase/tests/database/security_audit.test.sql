-- Security audit: structural checks that fail if a future migration forgets RLS
-- or opens something up, plus direct attempts to break tenant and role isolation.
-- Run with: npx supabase test db

begin;

create extension if not exists pgtap with schema extensions;

select plan(41);

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------

select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity $$,
  'every public table has row level security enabled'
);

select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and c.relname <> 'notification_log'
       and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) $$,
  'every public table has policies (notification_log is service_role only on purpose)'
);

select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and c.relname <> 'organizations'
       and not exists (select 1 from information_schema.columns k
                       where k.table_schema = 'public' and k.table_name = c.relname and k.column_name = 'organization_id') $$,
  'every tenant table has organization_id'
);

select is_empty(
  $$ select table_name || ' ' || privilege_type from information_schema.role_table_grants
     where grantee = 'anon' and table_schema in ('public', 'private') $$,
  'signed-out users have no table privileges at all'
);

select is_empty(
  $$ select table_name from information_schema.views where table_schema = 'public' $$,
  'no public views (views bypass RLS unless security_invoker)'
);

select is_empty(
  $$ select n.nspname || '.' || p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private') and p.prosecdef
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%') $$,
  'every security definer function pins search_path'
);

select results_eq(
  $$ select p.proname::text collate "C" from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute') order by 1 $$,
  $$ values ('check_invite'::text collate "C") $$,
  'check_invite is the only function signed-out users can call'
);

select is_empty(
  $$ select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('store_generated_visits', 'list_expired_media')
       and has_function_privilege('authenticated', p.oid, 'execute') $$,
  'system-job functions are service_role only'
);

select is_empty(
  $$ select id from storage.buckets where public $$,
  'no storage bucket is public'
);

select is(
  (select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects'),
  4,
  'pet-media has read, upload, update and delete policies (and nothing else)'
);

-- ---------------------------------------------------------------------------
-- Two businesses: A (admin, owner, two sitters) and B (admin, owner)
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('5e000000-0000-4000-8000-0000000000a1', 'admin@a.sec'),
  ('5e000000-0000-4000-8000-0000000000c1', 'owner@a.sec'),
  ('5e000000-0000-4000-8000-0000000000b1', 'sitter1@a.sec'),
  ('5e000000-0000-4000-8000-0000000000b2', 'sitter2@a.sec'),
  ('5e000000-0000-4000-8000-0000000000a9', 'admin@b.sec'),
  ('5e000000-0000-4000-8000-0000000000c9', 'owner@b.sec');

insert into public.organizations (id, name, timezone) values
  ('5e000000-0000-4000-8000-00000000000a', 'Org A', 'America/New_York'),
  ('5e000000-0000-4000-8000-00000000000b', 'Org B', 'America/New_York');

insert into public.profiles (id, organization_id, role, full_name) values
  ('5e000000-0000-4000-8000-0000000000a1', '5e000000-0000-4000-8000-00000000000a', 'admin', 'Admin A'),
  ('5e000000-0000-4000-8000-0000000000c1', '5e000000-0000-4000-8000-00000000000a', 'owner', 'Owner A'),
  ('5e000000-0000-4000-8000-0000000000b1', '5e000000-0000-4000-8000-00000000000a', 'sitter', 'Sitter One'),
  ('5e000000-0000-4000-8000-0000000000b2', '5e000000-0000-4000-8000-00000000000a', 'sitter', 'Sitter Two'),
  ('5e000000-0000-4000-8000-0000000000a9', '5e000000-0000-4000-8000-00000000000b', 'admin', 'Admin B'),
  ('5e000000-0000-4000-8000-0000000000c9', '5e000000-0000-4000-8000-00000000000b', 'owner', 'Owner B');

insert into public.households (id, organization_id, owner_id, address_line1, city) values
  ('5e000000-0000-4000-8000-0000000000da', '5e000000-0000-4000-8000-00000000000a', '5e000000-0000-4000-8000-0000000000c1', '1 A St', 'Town'),
  ('5e000000-0000-4000-8000-0000000000db', '5e000000-0000-4000-8000-00000000000b', '5e000000-0000-4000-8000-0000000000c9', '9 B St', 'Elsewhere');

insert into public.household_access (organization_id, household_id, entry_instructions, wifi_password) values
  ('5e000000-0000-4000-8000-00000000000b', '5e000000-0000-4000-8000-0000000000db', 'Key under mat', 'secret');

insert into public.pets (id, organization_id, household_id, name, species) values
  ('5e000000-0000-4000-8000-0000000000ea', '5e000000-0000-4000-8000-00000000000a', '5e000000-0000-4000-8000-0000000000da', 'Ace', 'dog'),
  ('5e000000-0000-4000-8000-0000000000eb', '5e000000-0000-4000-8000-00000000000b', '5e000000-0000-4000-8000-0000000000db', 'Bea', 'cat');

insert into public.bookings (id, organization_id, household_id, sitter_id, service_type, start_date, status) values
  ('5e000000-0000-4000-8000-0000000000fa', '5e000000-0000-4000-8000-00000000000a', '5e000000-0000-4000-8000-0000000000da',
   '5e000000-0000-4000-8000-0000000000b2', 'walk', current_date, 'confirmed'),
  ('5e000000-0000-4000-8000-0000000000fb', '5e000000-0000-4000-8000-00000000000b', '5e000000-0000-4000-8000-0000000000db',
   null, 'walk', current_date, 'confirmed');

-- Sitter Two's visit in A (Sitter One is not assigned to it), and a visit in B.
insert into public.visits (id, organization_id, booking_id, sitter_id, scheduled_start, scheduled_end, status, check_in_at) values
  ('5e000000-0000-4000-8000-000000000101', '5e000000-0000-4000-8000-00000000000a', '5e000000-0000-4000-8000-0000000000fa',
   '5e000000-0000-4000-8000-0000000000b2', now(), now() + interval '30 minutes', 'arrived', now()),
  ('5e000000-0000-4000-8000-000000000102', '5e000000-0000-4000-8000-00000000000b', '5e000000-0000-4000-8000-0000000000fb',
   null, now() + interval '1 hour', now() + interval '90 minutes', 'scheduled', null);

insert into public.messages (organization_id, household_id, sender_id, body) values
  ('5e000000-0000-4000-8000-00000000000b', '5e000000-0000-4000-8000-0000000000db', '5e000000-0000-4000-8000-0000000000c9', 'B private message');

create function pg_temp.sign_in(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;

-- ---------------------------------------------------------------------------
-- Owner of A attacks business B
-- ---------------------------------------------------------------------------

select pg_temp.sign_in('5e000000-0000-4000-8000-0000000000c1');
set local role authenticated;

select is_empty($$ select 1 from public.organizations where id = '5e000000-0000-4000-8000-00000000000b' $$,
  'owner A cannot see business B');
select is_empty($$ select 1 from public.households where organization_id = '5e000000-0000-4000-8000-00000000000b' $$,
  'owner A cannot read B''s households (addresses)');
select is_empty($$ select 1 from public.household_access $$,
  'owner A cannot read anyone''s entry codes or wifi from B');
select is_empty($$ select 1 from public.pets where id = '5e000000-0000-4000-8000-0000000000eb' $$,
  'owner A cannot read B''s pets');
select is_empty($$ select 1 from public.messages where organization_id = '5e000000-0000-4000-8000-00000000000b' $$,
  'owner A cannot read B''s messages');
select is_empty($$ select 1 from public.visits where organization_id = '5e000000-0000-4000-8000-00000000000b' $$,
  'owner A cannot read B''s visits');
select is_empty($$ select 1 from public.profiles where organization_id = '5e000000-0000-4000-8000-00000000000b' $$,
  'owner A cannot read B''s people (names, phones)');

select throws_ok(
  $$ insert into public.pets (organization_id, household_id, name, species)
     values ('5e000000-0000-4000-8000-00000000000b', '5e000000-0000-4000-8000-0000000000db', 'Planted', 'dog') $$,
  null, null,
  'owner A cannot insert a pet into B''s household'
);
select is_empty(
  $$ update public.pets set name = 'Hacked' where id = '5e000000-0000-4000-8000-0000000000eb' returning id $$,
  'owner A cannot rename B''s pet'
);
select is_empty(
  $$ delete from public.households where id = '5e000000-0000-4000-8000-0000000000db' returning id $$,
  'owner A cannot delete B''s household'
);
select throws_ok(
  $$ insert into public.messages (household_id, body) values ('5e000000-0000-4000-8000-0000000000db', 'hi') $$,
  null, null,
  'owner A cannot post into B''s conversation'
);
select throws_ok(
  $$ update public.profiles set role = 'admin' where id = '5e000000-0000-4000-8000-0000000000c1' $$,
  null, null,
  'owner A cannot promote themself to admin'
);
select throws_ok(
  $$ update public.profiles set organization_id = '5e000000-0000-4000-8000-00000000000b'
     where id = '5e000000-0000-4000-8000-0000000000c1' $$,
  null, null,
  'owner A cannot move themself into business B'
);
select ok(
  not private.can_read_media_path('5e000000-0000-4000-8000-00000000000b/5e000000-0000-4000-8000-000000000102/x.jpg')
  and not private.can_write_media_path('5e000000-0000-4000-8000-00000000000b/pets/5e000000-0000-4000-8000-0000000000eb/x.jpg'),
  'owner A cannot read or upload files in B''s storage folders'
);
select throws_ok(
  $$ select public.request_booking(
       p_service_type => 'walk',
       p_pet_ids => array['5e000000-0000-4000-8000-0000000000eb']::uuid[],
       p_start_date => current_date + 1,
       p_window_start => '10:00',
       p_duration_minutes => 30) $$,
  null, null,
  'owner A cannot book a visit for B''s household'
);
reset role;

-- ---------------------------------------------------------------------------
-- Sitter One attacks Sitter Two's visit (same business)
-- ---------------------------------------------------------------------------

select pg_temp.sign_in('5e000000-0000-4000-8000-0000000000b1');
set local role authenticated;

select is_empty(
  $$ update public.visits set status_line = 'mine now' where id = '5e000000-0000-4000-8000-000000000101' returning id $$,
  'a sitter cannot edit a visit assigned to someone else'
);
select is_empty(
  $$ update public.visits set sitter_id = '5e000000-0000-4000-8000-0000000000b1'
     where id = '5e000000-0000-4000-8000-000000000101' returning id $$,
  'a sitter cannot take over another sitter''s visit'
);
select throws_ok(
  $$ select public.advance_visit('5e000000-0000-4000-8000-000000000101', 'completed', null, null, null) $$,
  null, null,
  'a sitter cannot check out someone else''s visit'
);
select throws_ok(
  $$ insert into public.care_events (visit_id, type, value) values ('5e000000-0000-4000-8000-000000000101', 'fed', '{}') $$,
  null, null,
  'a sitter cannot log care on someone else''s visit'
);
select throws_ok(
  $$ insert into public.media (visit_id, type, storage_path)
     values ('5e000000-0000-4000-8000-000000000101', 'photo', '5e000000-0000-4000-8000-00000000000a/5e000000-0000-4000-8000-000000000101/x.jpg') $$,
  null, null,
  'a sitter cannot attach photos to someone else''s visit'
);
select ok(
  not private.can_write_media_path('5e000000-0000-4000-8000-00000000000a/5e000000-0000-4000-8000-000000000101/x.jpg'),
  'a sitter cannot upload into someone else''s visit folder'
);
select is_empty(
  $$ update public.bookings set status = 'cancelled' where id = '5e000000-0000-4000-8000-0000000000fa' returning id $$,
  'a sitter cannot cancel bookings'
);
select is_empty($$ select 1 from public.invites $$, 'sitters cannot list invite codes');
select throws_ok(
  $$ insert into public.invites (role) values ('admin') $$,
  null, null,
  'a sitter cannot mint an admin invite'
);
reset role;

-- ---------------------------------------------------------------------------
-- Admin of B attacks business A; signed-out callers
-- ---------------------------------------------------------------------------

select pg_temp.sign_in('5e000000-0000-4000-8000-0000000000a9');
set local role authenticated;
select is_empty(
  $$ update public.visits set sitter_id = null where organization_id = '5e000000-0000-4000-8000-00000000000a' returning id $$,
  'an admin cannot touch another business''s visits'
);
select is_empty(
  $$ update public.organizations set name = 'Pwned' where id = '5e000000-0000-4000-8000-00000000000a' returning id $$,
  'an admin cannot change another business''s settings'
);
reset role;

select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok($$ select 1 from public.households $$, '42501', null, 'signed-out users cannot read households');
select throws_ok($$ select 1 from public.messages $$, '42501', null, 'signed-out users cannot read messages');
reset role;

-- ---------------------------------------------------------------------------
-- Invite codes are rate limited per IP
-- ---------------------------------------------------------------------------

select set_config('request.headers', '{"x-forwarded-for": "6.6.6.6, 10.0.0.1"}', true);
set local role anon;
select lives_ok(
  $$ select public.check_invite('AAAAAAAA') from generate_series(1, 10) $$,
  'ten invite lookups in ten minutes are fine'
);
select throws_ok(
  $$ select public.check_invite('AAAAAAAB') $$,
  'PT429', null,
  'the eleventh lookup from the same IP is refused with 429'
);
reset role;

select set_config('request.headers', '{"x-forwarded-for": "6.6.6.6, 10.0.0.2"}', true);
set local role anon;
select lives_ok(
  $$ select public.check_invite('AAAAAAAA') $$,
  'another client (gateway hop) is not blocked by the first'
);
reset role;

select * from finish();
rollback;
