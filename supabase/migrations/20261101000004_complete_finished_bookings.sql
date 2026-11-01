-- Mark confirmed bookings completed once they're over.
--
-- A booking is over when its last day (end_date, or start_date for a one-off with
-- no end) is before today in the business's time zone and none of its visits is
-- still under way. Open-ended repeats never finish on their own. Completing a
-- booking sends no push (push_on_booking_status ignores 'completed') and leaves
-- its visits as they are.

create function private.complete_finished_bookings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  done integer;
begin
  update public.bookings b
     set status = 'completed'
    from public.organizations o
   where o.id = b.organization_id
     and b.status = 'confirmed'
     and coalesce(b.end_date, case when b.recurrence_rule is null then b.start_date end)
         < (now() at time zone o.timezone)::date
     and not exists (
       select 1 from public.visits v
       where v.booking_id = b.id and v.status in ('on_the_way', 'arrived', 'in_progress')
     );
  get diagnostics done = row_count;
  return done;
end;
$$;

revoke all on function private.complete_finished_bookings() from public, authenticated;

-- 08:10 UTC, just before the top-up so it skips bookings that just finished.
select cron.schedule('complete-finished-bookings', '10 8 * * *', $$select private.complete_finished_bookings()$$);
