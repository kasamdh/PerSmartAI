-- Push notifications for bookings, sent through notify-owner like visit events:
--   booking_requested  an owner asked for a booking            -> admins
--   booking_status     an admin confirmed or declined it        -> the owner
--   booking_cancelled  someone cancelled it (visits cancelled)  -> sitters and admins
-- The Edge Function looks up names and recipients after commit, so pets added in
-- the same transaction (request_booking) are included.

create function private.push_on_booking_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.send_push_event(jsonb_build_object(
    'type', 'booking_requested', 'booking_id', new.id
  ));
  return null;
end;
$$;

create trigger push_on_booking_insert
  after insert on public.bookings
  for each row
  when (new.status = 'requested')
  execute function private.push_on_booking_insert();

create function private.push_on_booking_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'cancelled' then
    -- actor_id lets the function skip notifying whoever cancelled.
    perform private.send_push_event(jsonb_build_object(
      'type', 'booking_cancelled', 'booking_id', new.id, 'actor_id', (select auth.uid())
    ));
  elsif old.status = 'requested' and new.status in ('confirmed', 'declined') then
    perform private.send_push_event(jsonb_build_object(
      'type', 'booking_status', 'booking_id', new.id, 'status', new.status
    ));
  end if;
  return null;
end;
$$;

create trigger push_on_booking_status
  after update of status on public.bookings
  for each row
  when (new.status is distinct from old.status)
  execute function private.push_on_booking_status();

revoke all on function private.push_on_booking_insert() from public;
revoke all on function private.push_on_booking_status() from public;
