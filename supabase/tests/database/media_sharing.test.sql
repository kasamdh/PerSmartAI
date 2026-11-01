-- Photo/video sharing: pets in media, hearts, videos, offline-synced care events,
-- retention. Run with: npx supabase test db

begin;

create extension if not exists pgtap with schema extensions;

select plan(21);

insert into auth.users (id, email) values
  ('f7000000-0000-4000-8000-0000000000a1', 'admin@media.test'),
  ('f7000000-0000-4000-8000-0000000000c1', 'owner1@media.test'),
  ('f7000000-0000-4000-8000-0000000000c2', 'owner2@media.test'),
  ('f7000000-0000-4000-8000-0000000000b1', 'sitter1@media.test'),
  ('f7000000-0000-4000-8000-0000000000b2', 'sitter2@media.test'),
  ('f7000000-0000-4000-8000-0000000000a9', 'admin@other-media.test');

insert into public.organizations (id, name, timezone, media_retention_months) values
  ('f7000000-0000-4000-8000-000000000001', 'Media Org', 'America/New_York', 6),
  ('f7000000-0000-4000-8000-000000000009', 'Keep Org', 'America/New_York', null);

insert into public.profiles (id, organization_id, role, full_name) values
  ('f7000000-0000-4000-8000-0000000000a1', 'f7000000-0000-4000-8000-000000000001', 'admin', 'Admin'),
  ('f7000000-0000-4000-8000-0000000000c1', 'f7000000-0000-4000-8000-000000000001', 'owner', 'Owner 1'),
  ('f7000000-0000-4000-8000-0000000000c2', 'f7000000-0000-4000-8000-000000000001', 'owner', 'Owner 2'),
  ('f7000000-0000-4000-8000-0000000000b1', 'f7000000-0000-4000-8000-000000000001', 'sitter', 'Sitter 1'),
  ('f7000000-0000-4000-8000-0000000000b2', 'f7000000-0000-4000-8000-000000000001', 'sitter', 'Sitter 2'),
  ('f7000000-0000-4000-8000-0000000000a9', 'f7000000-0000-4000-8000-000000000009', 'admin', 'Other Admin');

insert into public.households (id, organization_id, owner_id, address_line1, city) values
  ('f7000000-0000-4000-8000-0000000000d1', 'f7000000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-0000000000c1', '1 A St', 'Town'),
  ('f7000000-0000-4000-8000-0000000000d2', 'f7000000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-0000000000c2', '2 B St', 'Town');

insert into public.pets (id, organization_id, household_id, name, species) values
  ('f7000000-0000-4000-8000-0000000000e1', 'f7000000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-0000000000d1', 'Rex', 'dog'),
  ('f7000000-0000-4000-8000-0000000000e2', 'f7000000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-0000000000d1', 'Mochi', 'cat'),
  ('f7000000-0000-4000-8000-0000000000e3', 'f7000000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-0000000000d2', 'Other', 'dog');

insert into public.bookings (id, organization_id, household_id, sitter_id, service_type, start_date, status) values
  ('f7000000-0000-4000-8000-0000000000f1', 'f7000000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-0000000000d1',
   'f7000000-0000-4000-8000-0000000000b1', 'drop_in', current_date, 'confirmed');

insert into public.booking_pets (organization_id, booking_id, pet_id) values
  ('f7000000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-0000000000f1', 'f7000000-0000-4000-8000-0000000000e1'),
  ('f7000000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-0000000000f1', 'f7000000-0000-4000-8000-0000000000e2');

-- v1: checked out an hour ago (checked in 90 minutes ago).
insert into public.visits (id, organization_id, booking_id, sitter_id, scheduled_start, scheduled_end, status, check_in_at, check_out_at, started_at) values
  ('f7000000-0000-4000-8000-000000000101', 'f7000000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-0000000000f1',
   'f7000000-0000-4000-8000-0000000000b1', now() - interval '2 hours', now() - interval '1 hour', 'completed',
   now() - interval '90 minutes', now() - interval '60 minutes', now() - interval '89 minutes');

create function pg_temp.sign_in(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;

-- ---------------------------------------------------------------------------
-- Sitter: photos, videos, pets in them
-- ---------------------------------------------------------------------------

select pg_temp.sign_in('f7000000-0000-4000-8000-0000000000b1');
set local role authenticated;

select lives_ok(
  $$ insert into public.media (id, visit_id, storage_path, thumb_path, type, caption, width, height) values
       ('f7000000-0000-4000-8000-000000000201', 'f7000000-0000-4000-8000-000000000101',
        'f7000000-0000-4000-8000-000000000001/f7000000-0000-4000-8000-000000000101/f7000000-0000-4000-8000-000000000201.jpg',
        'f7000000-0000-4000-8000-000000000001/f7000000-0000-4000-8000-000000000101/f7000000-0000-4000-8000-000000000201-thumb.jpg',
        'photo', 'Nap time', 1080, 810) $$,
  'the sitter adds a photo with the id made on the phone (even after check-out)'
);

select throws_ok(
  $$ insert into public.media (id, visit_id, storage_path, type) values
       ('f7000000-0000-4000-8000-000000000201', 'f7000000-0000-4000-8000-000000000101', 'again.jpg', 'photo') $$,
  '23505', null,
  'resending the same photo is a duplicate, not a second photo'
);

select lives_ok(
  $$ insert into public.media (id, visit_id, storage_path, thumb_path, type, duration_seconds) values
       ('f7000000-0000-4000-8000-000000000202', 'f7000000-0000-4000-8000-000000000101',
        'f7000000-0000-4000-8000-000000000001/f7000000-0000-4000-8000-000000000101/f7000000-0000-4000-8000-000000000202.mp4',
        'f7000000-0000-4000-8000-000000000001/f7000000-0000-4000-8000-000000000101/f7000000-0000-4000-8000-000000000202-thumb.jpg',
        'video', 14.8) $$,
  'a 15 second video is fine'
);

select throws_ok(
  $$ insert into public.media (visit_id, storage_path, type, duration_seconds) values
       ('f7000000-0000-4000-8000-000000000101', 'long.mp4', 'video', 40) $$,
  '23514', null,
  'videos are at most 15 seconds'
);

select throws_ok(
  $$ insert into public.media (visit_id, storage_path, type) values
       ('f7000000-0000-4000-8000-000000000101', 'noduration.mp4', 'video') $$,
  '23514', null,
  'videos need their length'
);

select lives_ok(
  $$ insert into public.media_pets (media_id, pet_id) values
       ('f7000000-0000-4000-8000-000000000201', 'f7000000-0000-4000-8000-0000000000e1'),
       ('f7000000-0000-4000-8000-000000000201', 'f7000000-0000-4000-8000-0000000000e2') $$,
  'the sitter tags both pets in the photo'
);

select throws_ok(
  $$ insert into public.media_pets (media_id, pet_id) values
       ('f7000000-0000-4000-8000-000000000202', 'f7000000-0000-4000-8000-0000000000e3') $$,
  '23514', null,
  'pets from other households can''t be tagged'
);

select lives_ok(
  $$ insert into public.care_events (id, visit_id, pet_id, type, occurred_at) values
       ('f7000000-0000-4000-8000-000000000301', 'f7000000-0000-4000-8000-000000000101',
        'f7000000-0000-4000-8000-0000000000e1', 'pee', now() - interval '80 minutes') $$,
  'a care event logged offline during the visit syncs after check-out'
);

select throws_ok(
  $$ insert into public.care_events (visit_id, pet_id, type, occurred_at) values
       ('f7000000-0000-4000-8000-000000000101', 'f7000000-0000-4000-8000-0000000000e1', 'pee', now()) $$,
  '42501', null,
  'but nothing can be logged for after check-out'
);

select throws_ok(
  $$ insert into public.media_reactions (media_id) values ('f7000000-0000-4000-8000-000000000201') $$,
  '42501', null,
  'sitters can''t heart photos'
);

reset role;

-- ---------------------------------------------------------------------------
-- Owners: see and heart their own media only
-- ---------------------------------------------------------------------------

select pg_temp.sign_in('f7000000-0000-4000-8000-0000000000c1');
set local role authenticated;

select is(
  (select count(*)::int from public.media_pets where media_id = 'f7000000-0000-4000-8000-000000000201'),
  2,
  'the owner sees which pets are in the photo'
);

select lives_ok(
  $$ insert into public.media_reactions (media_id) values ('f7000000-0000-4000-8000-000000000201') $$,
  'the owner hearts a photo'
);

select throws_ok(
  $$ insert into public.media_reactions (media_id) values ('f7000000-0000-4000-8000-000000000201') $$,
  '23505', null,
  'one heart per person'
);

select throws_ok(
  $$ insert into public.media_pets (media_id, pet_id) values
       ('f7000000-0000-4000-8000-000000000202', 'f7000000-0000-4000-8000-0000000000e1') $$,
  '42501', null,
  'owners can''t tag media'
);

reset role;

select pg_temp.sign_in('f7000000-0000-4000-8000-0000000000c2');
set local role authenticated;
select is_empty(
  $$ select 1 from public.media_pets union all select 1 from public.media_reactions $$,
  'other owners see neither the tags nor the hearts'
);
select throws_ok(
  $$ insert into public.media_reactions (media_id) values ('f7000000-0000-4000-8000-000000000201') $$,
  '42501', null,
  'other owners can''t heart it'
);
reset role;

select pg_temp.sign_in('f7000000-0000-4000-8000-0000000000b2');
set local role authenticated;
select is_empty(
  $$ select 1 from public.media_pets union all select 1 from public.media_reactions $$,
  'other sitters see neither'
);
reset role;

select pg_temp.sign_in('f7000000-0000-4000-8000-0000000000a9');
set local role authenticated;
select is_empty(
  $$ select 1 from public.media_pets union all select 1 from public.media_reactions $$,
  'admins of another business see neither'
);
reset role;

select pg_temp.sign_in('f7000000-0000-4000-8000-0000000000b1');
set local role authenticated;
select is(
  (select count(*)::int from public.media_reactions where media_id = 'f7000000-0000-4000-8000-000000000201'),
  1,
  'the sitter sees the owner''s heart'
);
reset role;

-- ---------------------------------------------------------------------------
-- Retention
-- ---------------------------------------------------------------------------

update public.media set created_at = now() - interval '7 months'
 where id = 'f7000000-0000-4000-8000-000000000202';

select is(
  (select array_agg(id) from public.list_expired_media()),
  array['f7000000-0000-4000-8000-000000000202'::uuid],
  'media past the 6 month retention is listed for deletion; newer media is kept'
);

select pg_temp.sign_in('f7000000-0000-4000-8000-0000000000a1');
set local role authenticated;
select throws_ok(
  $$ select * from public.list_expired_media() $$,
  '42501', null,
  'only the scheduled job can list expired media'
);
reset role;

select * from finish();
rollback;
