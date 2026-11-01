-- Branding and incident resolution. Run with: npx supabase test db

begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

insert into auth.users (id, email) values
  ('fa000000-0000-4000-8000-0000000000a1', 'admin@brand.test'),
  ('fa000000-0000-4000-8000-0000000000c1', 'owner@brand.test'),
  ('fa000000-0000-4000-8000-0000000000b1', 'sitter@brand.test'),
  ('fa000000-0000-4000-8000-0000000000a9', 'admin@other-brand.test');

insert into public.organizations (id, name, timezone) values
  ('fa000000-0000-4000-8000-000000000001', 'Brand Org', 'America/New_York'),
  ('fa000000-0000-4000-8000-000000000009', 'Other', 'America/New_York');

insert into public.profiles (id, organization_id, role, full_name) values
  ('fa000000-0000-4000-8000-0000000000a1', 'fa000000-0000-4000-8000-000000000001', 'admin', 'Admin'),
  ('fa000000-0000-4000-8000-0000000000c1', 'fa000000-0000-4000-8000-000000000001', 'owner', 'Owner'),
  ('fa000000-0000-4000-8000-0000000000b1', 'fa000000-0000-4000-8000-000000000001', 'sitter', 'Sitter'),
  ('fa000000-0000-4000-8000-0000000000a9', 'fa000000-0000-4000-8000-000000000009', 'admin', 'Other Admin');

insert into public.households (id, organization_id, owner_id, address_line1, city) values
  ('fa000000-0000-4000-8000-0000000000d1', 'fa000000-0000-4000-8000-000000000001', 'fa000000-0000-4000-8000-0000000000c1', '1 A St', 'Town');
insert into public.bookings (id, organization_id, household_id, sitter_id, service_type, start_date, status) values
  ('fa000000-0000-4000-8000-0000000000f1', 'fa000000-0000-4000-8000-000000000001', 'fa000000-0000-4000-8000-0000000000d1',
   'fa000000-0000-4000-8000-0000000000b1', 'walk', current_date, 'confirmed');
insert into public.visits (id, organization_id, booking_id, sitter_id, scheduled_start, scheduled_end, status, check_in_at) values
  ('fa000000-0000-4000-8000-000000000101', 'fa000000-0000-4000-8000-000000000001', 'fa000000-0000-4000-8000-0000000000f1',
   'fa000000-0000-4000-8000-0000000000b1', now(), now() + interval '30 minutes', 'arrived', now());
insert into public.incidents (id, organization_id, visit_id, severity, description, created_by) values
  ('fa000000-0000-4000-8000-000000000201', 'fa000000-0000-4000-8000-000000000001', 'fa000000-0000-4000-8000-000000000101',
   'minor', 'Scraped paw', 'fa000000-0000-4000-8000-0000000000b1');

create function pg_temp.sign_in(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;

-- Branding
select pg_temp.sign_in('fa000000-0000-4000-8000-0000000000a1');
set local role authenticated;
select lives_ok(
  $$ update public.organizations set name = 'Happy Paws', primary_color = '#0E7C66', accent_color = '#F2A900',
       logo_path = 'fa000000-0000-4000-8000-000000000001/branding/logo.png'
     where id = 'fa000000-0000-4000-8000-000000000001' $$,
  'admins set the business name, colors and logo'
);
select throws_ok(
  $$ update public.organizations set primary_color = 'teal' where id = 'fa000000-0000-4000-8000-000000000001' $$,
  '23514', null,
  'colors must be #RRGGBB'
);
select throws_ok(
  $$ update public.organizations set logo_path = 'fa000000-0000-4000-8000-000000000009/branding/x.png'
     where id = 'fa000000-0000-4000-8000-000000000001' $$,
  '23514', null,
  'the logo must be in the business''s own branding folder'
);
select ok(
  private.can_write_media_path('fa000000-0000-4000-8000-000000000001/branding/logo.png'),
  'admins can upload the logo'
);
reset role;

select pg_temp.sign_in('fa000000-0000-4000-8000-0000000000c1');
set local role authenticated;
select ok(
  private.can_read_media_path('fa000000-0000-4000-8000-000000000001/branding/logo.png')
  and not private.can_write_media_path('fa000000-0000-4000-8000-000000000001/branding/logo.png'),
  'owners see the logo but can''t change it'
);
select is(
  (select primary_color from public.organizations where id = 'fa000000-0000-4000-8000-000000000001'),
  '#0E7C66',
  'members read their business''s colors (for the app''s branding)'
);
reset role;

select pg_temp.sign_in('fa000000-0000-4000-8000-0000000000a9');
set local role authenticated;
select ok(
  not private.can_read_media_path('fa000000-0000-4000-8000-000000000001/branding/logo.png'),
  'another business can''t read the logo'
);
reset role;

-- Incidents
select pg_temp.sign_in('fa000000-0000-4000-8000-0000000000b1');
set local role authenticated;
select lives_ok(
  $$ update public.incidents set description = 'Scraped paw, cleaned it' where id = 'fa000000-0000-4000-8000-000000000201' $$,
  'the sitter can still edit their report'
);
select throws_ok(
  $$ update public.incidents set resolved_at = now() where id = 'fa000000-0000-4000-8000-000000000201' $$,
  '42501', null,
  'sitters can''t resolve incidents'
);
reset role;

select pg_temp.sign_in('fa000000-0000-4000-8000-0000000000a1');
set local role authenticated;
update public.incidents set resolved_at = now(), resolution_note = 'Called the owner'
 where id = 'fa000000-0000-4000-8000-000000000201';
select results_eq(
  $$ select resolved_by, resolution_note from public.incidents where id = 'fa000000-0000-4000-8000-000000000201' $$,
  $$ values ('fa000000-0000-4000-8000-0000000000a1'::uuid, 'Called the owner') $$,
  'admins resolve incidents; who resolved it is recorded'
);
select is_empty(
  $$ select 1 from public.incidents where resolved_at is null $$,
  'resolved incidents are no longer open'
);
reset role;

select * from finish();
rollback;
