-- A new booking starts its own series, named after itself; split-off bookings
-- (reschedule_booking) pass their original's series_id. A column default can't
-- refer to the row's id, so a trigger fills it in.

alter table public.bookings alter column series_id drop default;

create function private.default_booking_series()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Clients may not attach a booking to another series.
  if new.series_id is null or private.is_client_non_admin() then
    new.series_id := new.id;
  end if;
  return new;
end;
$$;

create trigger default_booking_series
  before insert on public.bookings
  for each row execute function private.default_booking_series();

revoke all on function private.default_booking_series() from public;
