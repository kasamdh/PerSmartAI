-- Booking push triggers queue the right events for notify-owner.
-- Relies on the Vault secrets from seed.sql (as `npm run db:reset` sets up).
-- Queued pg_net requests are only sent after commit, and this test rolls back.

begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email) values
  ('f1000000-0000-4000-8000-0000000000a1', 'admin@push.test'),
  ('f1000000-0000-4000-8000-0000000000c1', 'owner@push.test'),
  ('f1000000-0000-4000-8000-0000000000b1', 'sitter@push.test');

insert into public.organizations (id, name, timezone) values
  ('f1000000-0000-4000-8000-000000000001', 'Push Org', 'America/New_York');

insert into public.profiles (id, organization_id, role, full_name) values
  ('f1000000-0000-4000-8000-0000000000a1', 'f1000000-0000-4000-8000-000000000001', 'admin', 'Admin'),
  ('f1000000-0000-4000-8000-0000000000c1', 'f1000000-0000-4000-8000-000000000001', 'owner', 'Owner'),
  ('f1000000-0000-4000-8000-0000000000b1', 'f1000000-0000-4000-8000-000000000001', 'sitter', 'Sitter');

insert into public.households (id, organization_id, owner_id, address_line1, city) values
  ('f1000000-0000-4000-8000-0000000000d1', 'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-0000000000c1', '1 A St', 'Town');

insert into public.pets (id, organization_id, household_id, name, species) values
  ('f1000000-0000-4000-8000-0000000000e1', 'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-0000000000d1', 'Pip', 'dog');

create function pg_temp.sign_in(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;

-- Booking events queued so far, oldest first.
create function pg_temp.booking_events() returns setof jsonb language sql as $$
  select convert_from(body, 'utf8')::jsonb
  from net.http_request_queue
  where url like '%/notify-owner'
    and convert_from(body, 'utf8')::jsonb ->> 'type' like 'booking_%'
  order by id
$$;

create temp table req (id uuid, declined uuid) on commit drop;
grant all on req to authenticated;

select pg_temp.sign_in('f1000000-0000-4000-8000-0000000000c1');
set local role authenticated;
insert into req (id, declined) values (
  public.request_booking('walk', array['f1000000-0000-4000-8000-0000000000e1']::uuid[], current_date + 2, current_date + 4,
    '10:00', null, 30, 'FREQ=DAILY'),
  public.request_booking('drop_in', array['f1000000-0000-4000-8000-0000000000e1']::uuid[], current_date + 3)
);
reset role;

select results_eq(
  $$ select e ->> 'type', (e ->> 'booking_id')::uuid from pg_temp.booking_events() e $$,
  $$ select 'booking_requested', id from req union all select 'booking_requested', declined from req $$,
  'each new request queues a booking_requested event'
);

select pg_temp.sign_in('f1000000-0000-4000-8000-0000000000a1');
set local role authenticated;
select public.confirm_booking((select id from req), 'f1000000-0000-4000-8000-0000000000b1');
select public.confirm_booking((select id from req), 'f1000000-0000-4000-8000-0000000000b1');
update public.bookings set status = 'declined' where id = (select declined from req);
reset role;

select is(
  (select e ->> 'status' from pg_temp.booking_events() e
   where e ->> 'type' = 'booking_status' and (e ->> 'booking_id')::uuid = (select id from req)),
  'confirmed',
  'confirming a request queues booking_status confirmed'
);

select is(
  (select count(*)::int from pg_temp.booking_events() e
   where e ->> 'type' = 'booking_status' and (e ->> 'booking_id')::uuid = (select id from req)),
  1,
  're-confirming (reassigning) does not notify the owner again'
);

select is(
  (select e ->> 'status' from pg_temp.booking_events() e
   where (e ->> 'booking_id')::uuid = (select declined from req) and e ->> 'type' = 'booking_status'),
  'declined',
  'declining a request queues booking_status declined'
);

select pg_temp.sign_in('f1000000-0000-4000-8000-0000000000c1');
set local role authenticated;
update public.bookings set status = 'cancelled' where id = (select id from req);
reset role;

select is(
  (select e ->> 'actor_id' from pg_temp.booking_events() e
   where e ->> 'type' = 'booking_cancelled'),
  'f1000000-0000-4000-8000-0000000000c1',
  'cancelling queues booking_cancelled with who cancelled'
);

select is(
  (select count(*)::int from pg_temp.booking_events()),
  5,
  'nothing else was queued (2 requests, confirm, decline, cancel)'
);

select * from finish();
rollback;
