-- Household chat: who can take part, read receipts, unread counts, chat photos.
-- Run with: npx supabase test db

begin;

create extension if not exists pgtap with schema extensions;

select plan(30);

insert into auth.users (id, email) values
  ('f9000000-0000-4000-8000-0000000000a1', 'admin@chat.test'),
  ('f9000000-0000-4000-8000-0000000000c1', 'owner1@chat.test'),
  ('f9000000-0000-4000-8000-0000000000c2', 'owner2@chat.test'),
  ('f9000000-0000-4000-8000-0000000000b1', 'recent@chat.test'),
  ('f9000000-0000-4000-8000-0000000000b2', 'upcoming@chat.test'),
  ('f9000000-0000-4000-8000-0000000000b3', 'long-ago@chat.test'),
  ('f9000000-0000-4000-8000-0000000000b4', 'cancelled@chat.test'),
  ('f9000000-0000-4000-8000-0000000000b5', 'far-future@chat.test'),
  ('f9000000-0000-4000-8000-0000000000b6', 'stranger@chat.test'),
  ('f9000000-0000-4000-8000-0000000000a9', 'admin@other-chat.test');

insert into public.organizations (id, name, timezone) values
  ('f9000000-0000-4000-8000-000000000001', 'Chat Org', 'America/New_York'),
  ('f9000000-0000-4000-8000-000000000009', 'Other Org', 'America/New_York');

insert into public.profiles (id, organization_id, role, full_name) values
  ('f9000000-0000-4000-8000-0000000000a1', 'f9000000-0000-4000-8000-000000000001', 'admin', 'Admin'),
  ('f9000000-0000-4000-8000-0000000000c1', 'f9000000-0000-4000-8000-000000000001', 'owner', 'Owner 1'),
  ('f9000000-0000-4000-8000-0000000000c2', 'f9000000-0000-4000-8000-000000000001', 'owner', 'Owner 2'),
  ('f9000000-0000-4000-8000-0000000000b1', 'f9000000-0000-4000-8000-000000000001', 'sitter', 'Recent'),
  ('f9000000-0000-4000-8000-0000000000b2', 'f9000000-0000-4000-8000-000000000001', 'sitter', 'Upcoming'),
  ('f9000000-0000-4000-8000-0000000000b3', 'f9000000-0000-4000-8000-000000000001', 'sitter', 'Long ago'),
  ('f9000000-0000-4000-8000-0000000000b4', 'f9000000-0000-4000-8000-000000000001', 'sitter', 'Cancelled'),
  ('f9000000-0000-4000-8000-0000000000b5', 'f9000000-0000-4000-8000-000000000001', 'sitter', 'Far future'),
  ('f9000000-0000-4000-8000-0000000000b6', 'f9000000-0000-4000-8000-000000000001', 'sitter', 'Stranger'),
  ('f9000000-0000-4000-8000-0000000000a9', 'f9000000-0000-4000-8000-000000000009', 'admin', 'Other Admin');

insert into public.households (id, organization_id, owner_id, name, address_line1, city) values
  ('f9000000-0000-4000-8000-0000000000d1', 'f9000000-0000-4000-8000-000000000001', 'f9000000-0000-4000-8000-0000000000c1', 'Lee home', '1 A St', 'Town'),
  ('f9000000-0000-4000-8000-0000000000d2', 'f9000000-0000-4000-8000-000000000001', 'f9000000-0000-4000-8000-0000000000c2', 'Patel home', '2 B St', 'Town');

insert into public.bookings (id, organization_id, household_id, service_type, start_date, status) values
  ('f9000000-0000-4000-8000-0000000000f1', 'f9000000-0000-4000-8000-000000000001', 'f9000000-0000-4000-8000-0000000000d1', 'walk', current_date, 'confirmed');

-- Visits for household d1, one per sitter: 20 days ago, in 20 days, 40 days ago,
-- cancelled (tomorrow), and 40 days from now. b6 has none.
insert into public.visits (organization_id, booking_id, sitter_id, scheduled_start, scheduled_end, status) values
  ('f9000000-0000-4000-8000-000000000001', 'f9000000-0000-4000-8000-0000000000f1', 'f9000000-0000-4000-8000-0000000000b1', now() - interval '20 days', now() - interval '20 days' + interval '30 minutes', 'completed'),
  ('f9000000-0000-4000-8000-000000000001', 'f9000000-0000-4000-8000-0000000000f1', 'f9000000-0000-4000-8000-0000000000b2', now() + interval '20 days', now() + interval '20 days 30 minutes', 'scheduled'),
  ('f9000000-0000-4000-8000-000000000001', 'f9000000-0000-4000-8000-0000000000f1', 'f9000000-0000-4000-8000-0000000000b3', now() - interval '40 days', now() - interval '40 days' + interval '30 minutes', 'completed'),
  ('f9000000-0000-4000-8000-000000000001', 'f9000000-0000-4000-8000-0000000000f1', 'f9000000-0000-4000-8000-0000000000b4', now() + interval '1 day', now() + interval '1 day 30 minutes', 'cancelled'),
  ('f9000000-0000-4000-8000-000000000001', 'f9000000-0000-4000-8000-0000000000f1', 'f9000000-0000-4000-8000-0000000000b5', now() + interval '40 days', now() + interval '40 days 30 minutes', 'scheduled');

create function pg_temp.sign_in(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
$$;

-- Can this user send a message to household d1 / read its thread?
create function pg_temp.can_send(p_user uuid, p_household uuid) returns boolean language plpgsql as $$
begin
  perform pg_temp.sign_in(p_user);
  set local role authenticated;
  begin
    insert into public.messages (household_id, body) values (p_household, 'hi from ' || p_user);
    reset role;
    return true;
  exception when insufficient_privilege then
    reset role;
    return false;
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can write
-- ---------------------------------------------------------------------------

select ok(pg_temp.can_send('f9000000-0000-4000-8000-0000000000c1', 'f9000000-0000-4000-8000-0000000000d1'), 'the owner can message their household');
select ok(pg_temp.can_send('f9000000-0000-4000-8000-0000000000a1', 'f9000000-0000-4000-8000-0000000000d1'), 'the business''s admin can');
select ok(pg_temp.can_send('f9000000-0000-4000-8000-0000000000b1', 'f9000000-0000-4000-8000-0000000000d1'), 'a sitter with a visit in the last 30 days can');
select ok(pg_temp.can_send('f9000000-0000-4000-8000-0000000000b2', 'f9000000-0000-4000-8000-0000000000d1'), 'a sitter with a visit in the next 30 days can');
select ok(not pg_temp.can_send('f9000000-0000-4000-8000-0000000000b3', 'f9000000-0000-4000-8000-0000000000d1'), 'a sitter whose last visit was 40 days ago can''t');
select ok(not pg_temp.can_send('f9000000-0000-4000-8000-0000000000b5', 'f9000000-0000-4000-8000-0000000000d1'), 'a sitter whose next visit is 40 days away can''t yet');
select ok(not pg_temp.can_send('f9000000-0000-4000-8000-0000000000b4', 'f9000000-0000-4000-8000-0000000000d1'), 'a cancelled visit doesn''t count');
select ok(not pg_temp.can_send('f9000000-0000-4000-8000-0000000000b6', 'f9000000-0000-4000-8000-0000000000d1'), 'a sitter who never visits can''t');
select ok(not pg_temp.can_send('f9000000-0000-4000-8000-0000000000c2', 'f9000000-0000-4000-8000-0000000000d1'), 'another owner can''t');
select ok(not pg_temp.can_send('f9000000-0000-4000-8000-0000000000a9', 'f9000000-0000-4000-8000-0000000000d1'), 'another business''s admin can''t');
select ok(not pg_temp.can_send('f9000000-0000-4000-8000-0000000000b1', 'f9000000-0000-4000-8000-0000000000d2'), 'a sitter can''t message a household they don''t visit');

-- ---------------------------------------------------------------------------
-- Who can read
-- ---------------------------------------------------------------------------

create function pg_temp.visible(p_user uuid) returns int language plpgsql as $$
declare
  n int;
begin
  perform pg_temp.sign_in(p_user);
  set local role authenticated;
  select count(*) into n from public.messages where household_id = 'f9000000-0000-4000-8000-0000000000d1';
  reset role;
  return n;
end;
$$;

select is(pg_temp.visible('f9000000-0000-4000-8000-0000000000c1'), 4, 'the owner reads the whole thread');
select is(pg_temp.visible('f9000000-0000-4000-8000-0000000000a1'), 4, 'the admin reads it');
select is(pg_temp.visible('f9000000-0000-4000-8000-0000000000b2'), 4, 'an upcoming sitter reads it');
select is(pg_temp.visible('f9000000-0000-4000-8000-0000000000b3'), 0, 'a sitter from 40 days ago reads nothing');
select is(pg_temp.visible('f9000000-0000-4000-8000-0000000000c2'), 0, 'another owner reads nothing');
select is(pg_temp.visible('f9000000-0000-4000-8000-0000000000a9'), 0, 'another business''s admin reads nothing');

-- ---------------------------------------------------------------------------
-- Integrity
-- ---------------------------------------------------------------------------

select pg_temp.sign_in('f9000000-0000-4000-8000-0000000000b1');
set local role authenticated;
select throws_ok(
  $$ insert into public.messages (household_id, sender_id, body)
     values ('f9000000-0000-4000-8000-0000000000d1', 'f9000000-0000-4000-8000-0000000000c1', 'pretending') $$,
  null, null,
  'nobody can send as someone else'
);
update public.messages set body = 'edited' where household_id = 'f9000000-0000-4000-8000-0000000000d1';
select is(
  (select count(*)::int from public.messages where body = 'edited'),
  0,
  'messages can''t be edited (there is no update policy)'
);
select throws_ok(
  $$ insert into public.messages (household_id, body, photo_path)
     values ('f9000000-0000-4000-8000-0000000000d1', null, 'f9000000-0000-4000-8000-000000000001/chat/f9000000-0000-4000-8000-0000000000d2/x.jpg') $$,
  '23514', null,
  'a chat photo must be in this household''s chat folder'
);
select lives_ok(
  $$ insert into public.messages (household_id, photo_path, photo_thumb_path)
     values ('f9000000-0000-4000-8000-0000000000d1',
             'f9000000-0000-4000-8000-000000000001/chat/f9000000-0000-4000-8000-0000000000d1/p.jpg',
             'f9000000-0000-4000-8000-000000000001/chat/f9000000-0000-4000-8000-0000000000d1/p-thumb.jpg') $$,
  'a photo message without text is fine'
);
reset role;

-- ---------------------------------------------------------------------------
-- Storage: chat photos follow the same participant rule
-- ---------------------------------------------------------------------------

select pg_temp.sign_in('f9000000-0000-4000-8000-0000000000b2');
set local role authenticated;
select ok(
  private.can_write_media_path('f9000000-0000-4000-8000-000000000001/chat/f9000000-0000-4000-8000-0000000000d1/a.jpg')
  and private.can_read_media_path('f9000000-0000-4000-8000-000000000001/chat/f9000000-0000-4000-8000-0000000000d1/a.jpg'),
  'participants can upload and view chat photos'
);
reset role;
select pg_temp.sign_in('f9000000-0000-4000-8000-0000000000b3');
set local role authenticated;
select ok(
  not private.can_read_media_path('f9000000-0000-4000-8000-000000000001/chat/f9000000-0000-4000-8000-0000000000d1/a.jpg')
  and not private.can_write_media_path('f9000000-0000-4000-8000-000000000001/chat/f9000000-0000-4000-8000-0000000000d1/a.jpg'),
  'former sitters can''t'
);
reset role;

-- ---------------------------------------------------------------------------
-- Read receipts and unread counts
-- ---------------------------------------------------------------------------

select pg_temp.sign_in('f9000000-0000-4000-8000-0000000000c1');
set local role authenticated;
select is(public.unread_message_count(), 4, 'the owner has 4 unread (their own message doesn''t count)');
select is(
  (select unread from public.my_conversations() where household_id = 'f9000000-0000-4000-8000-0000000000d1'),
  4,
  'the conversation list shows the same count'
);
insert into public.conversation_reads (household_id, read_at) values ('f9000000-0000-4000-8000-0000000000d1', now() + interval '1 second');
select is(public.unread_message_count(), 0, 'reading the conversation clears it');
update public.conversation_reads set read_at = now() - interval '1 day' where household_id = 'f9000000-0000-4000-8000-0000000000d1';
select is(public.unread_message_count(), 0, 'read_at never moves backwards');
reset role;

select pg_temp.sign_in('f9000000-0000-4000-8000-0000000000b2');
set local role authenticated;
select is(
  (select count(*)::int from public.conversation_reads where household_id = 'f9000000-0000-4000-8000-0000000000d1'),
  1,
  'participants see others'' read receipts'
);
select throws_ok(
  $$ insert into public.conversation_reads (household_id, user_id) values
       ('f9000000-0000-4000-8000-0000000000d1', 'f9000000-0000-4000-8000-0000000000c1') $$,
  '42501', null,
  'nobody marks a conversation read for someone else'
);
reset role;

select pg_temp.sign_in('f9000000-0000-4000-8000-0000000000a1');
set local role authenticated;
select is(
  (select count(*)::int from public.my_conversations()),
  2,
  'the admin sees every household''s conversation in the business'
);
reset role;

select * from finish();
rollback;
