-- Push notifications: per-user settings, a send log, sitter schedule alerts, the
-- "not eating" alert, batched photo alerts, and the scheduled checks.
--
-- Pushes are sent only by Edge Functions (Expo Push API). Database triggers queue
-- events for notify-owner through private.send_push_event (pg_net); pg_cron runs
-- alert-checks for photo batches (every minute) and late check-ins, reminders and
-- medication due (every 5 minutes).

-- ---------------------------------------------------------------------------
-- notification_settings: which alerts a user turned off
-- ---------------------------------------------------------------------------

create table public.notification_settings (
  user_id uuid primary key,
  organization_id uuid not null default private.current_org_id()
    references public.organizations (id) on delete cascade,
  -- Alert kinds from supabase/functions/_shared/alerts.ts. Incidents can't be muted.
  muted text[] not null default '{}' check (not ('incident' = any (muted))),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, organization_id)
    references public.profiles (id, organization_id) on delete cascade
);

create index notification_settings_organization_id_idx on public.notification_settings (organization_id);

create trigger set_updated_at before update on public.notification_settings
  for each row execute function private.set_updated_at();

alter table public.notification_settings enable row level security;
revoke all on public.notification_settings from anon;

create policy "users read own notification settings" on public.notification_settings
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "users create own notification settings" on public.notification_settings
  for insert to authenticated
  with check (user_id = (select auth.uid()) and organization_id = (select private.current_org_id()));

create policy "users change own notification settings" on public.notification_settings
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and organization_id = (select private.current_org_id()));

-- ---------------------------------------------------------------------------
-- notification_log: alerts already sent (dedupe and photo batching)
-- ---------------------------------------------------------------------------
-- One row per (kind, key): a visit's reminder or late alert, a medication dose,
-- or a visit's latest photo batch (covered_until = newest photo it included).
-- Only the Edge Functions (service_role) use it.

create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null,
  key text not null,
  visit_id uuid,
  covered_until timestamptz,
  sent_at timestamptz not null default now(),
  unique (kind, key),
  foreign key (visit_id, organization_id)
    references public.visits (id, organization_id) on delete cascade
);

create index notification_log_visit_id_idx on public.notification_log (visit_id);
create index notification_log_organization_id_idx on public.notification_log (organization_id);

alter table public.notification_log enable row level security;
revoke all on public.notification_log from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Photos: batched by alert-checks instead of one push per insert
-- ---------------------------------------------------------------------------

drop trigger push_on_media_insert on public.media;
drop function private.push_on_media_insert();

create index media_created_at_idx on public.media (created_at);

-- ---------------------------------------------------------------------------
-- Sitters: bookings assigned, taken away, or changed
-- ---------------------------------------------------------------------------

create function private.push_on_booking_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'confirmed' or (select auth.uid()) is null then
    return null;
  end if;

  if new.sitter_id is distinct from old.sitter_id or old.status is distinct from 'confirmed' then
    if new.sitter_id is not null then
      perform private.send_push_event(jsonb_build_object(
        'type', 'booking_assigned', 'booking_id', new.id, 'sitter_id', new.sitter_id
      ));
    end if;
    if old.sitter_id is not null and old.sitter_id is distinct from new.sitter_id then
      perform private.send_push_event(jsonb_build_object(
        'type', 'booking_unassigned', 'booking_id', new.id, 'sitter_id', old.sitter_id
      ));
    end if;
  elsif new.sitter_id is not null and (
    new.recurrence_rule, new.start_date, new.end_date, new.window_start, new.window_end, new.duration_minutes
  ) is distinct from (
    old.recurrence_rule, old.start_date, old.end_date, old.window_start, old.window_end, old.duration_minutes
  ) then
    perform private.send_push_event(jsonb_build_object(
      'type', 'booking_changed', 'booking_id', new.id, 'sitter_id', new.sitter_id
    ));
  end if;
  return null;
end;
$$;

create trigger push_on_booking_schedule
  after update on public.bookings
  for each row execute function private.push_on_booking_schedule();

-- ---------------------------------------------------------------------------
-- Sitters: one visit reassigned, moved, or cancelled
-- ---------------------------------------------------------------------------
-- Changes made by an admin to a single upcoming visit. System jobs (no signed-in
-- user) and the booking-cancel cascade send nothing.

create function private.push_on_visit_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking_sitter uuid;
  booking_updated timestamptz;
begin
  if (select auth.uid()) is null
     or current_setting('app.booking_cancel_cascade', true) = 'on'
     or new.scheduled_end <= now() then
    return null;
  end if;

  if new.status = 'cancelled' and old.status = 'scheduled' then
    if old.sitter_id is not null then
      perform private.send_push_event(jsonb_build_object(
        'type', 'visit_cancelled', 'visit_id', new.id, 'sitter_id', old.sitter_id
      ));
    end if;
    return null;
  end if;
  if new.status <> 'scheduled' then
    return null;
  end if;

  if new.sitter_id is distinct from old.sitter_id then
    -- A whole booking reassigned in this transaction (apply_booking_plan) moves its
    -- visits along with it; the booking push covers those. (updated_at = now()
    -- means the booking row changed in this same transaction.)
    select sitter_id, updated_at into booking_sitter, booking_updated
    from public.bookings where id = new.booking_id;
    if new.sitter_id is not distinct from booking_sitter and booking_updated = now() then
      return null;
    end if;
    if new.sitter_id is not null then
      perform private.send_push_event(jsonb_build_object('type', 'visit_assigned', 'visit_id', new.id));
    end if;
    if old.sitter_id is not null then
      perform private.send_push_event(jsonb_build_object(
        'type', 'visit_unassigned', 'visit_id', new.id, 'sitter_id', old.sitter_id
      ));
    end if;
  elsif new.sitter_id is not null
        and (new.scheduled_start, new.scheduled_end) is distinct from (old.scheduled_start, old.scheduled_end) then
    perform private.send_push_event(jsonb_build_object('type', 'visit_changed', 'visit_id', new.id));
  end if;
  return null;
end;
$$;

create trigger push_on_visit_schedule
  after update of sitter_id, scheduled_start, scheduled_end, status on public.visits
  for each row execute function private.push_on_visit_schedule();

-- ---------------------------------------------------------------------------
-- Smart alert: a pet ate nothing at two meals in a row
-- ---------------------------------------------------------------------------
-- Fires when the streak reaches exactly two, so a third refusal doesn't repeat it.
-- "In a row" follows when meals happened (occurred_at), across visits.

create function private.food_refusal_streak(p_pet_id uuid, p_until timestamptz)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with meals as (
    select coalesce(value ->> 'amount_eaten', '') = 'none' as refused,
           row_number() over (order by occurred_at desc, created_at desc) as n
    from public.care_events
    where pet_id = p_pet_id and type = 'fed' and occurred_at <= p_until
  )
  select coalesce(min(n) - 1, (select count(*) from meals))::int
  from meals
  where not refused
$$;

create function private.push_on_food_refused()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pet_name text;
begin
  if new.pet_id is null or private.food_refusal_streak(new.pet_id, new.occurred_at) <> 2 then
    return null;
  end if;
  select name into pet_name from public.pets where id = new.pet_id;
  perform private.send_push_event(jsonb_build_object(
    'type', 'food_refused', 'visit_id', new.visit_id, 'pet_id', new.pet_id, 'pet_name', pet_name
  ));
  return null;
end;
$$;

create trigger push_on_food_refused
  after insert on public.care_events
  for each row
  when (new.type = 'fed' and new.value ->> 'amount_eaten' = 'none')
  execute function private.push_on_food_refused();

-- ---------------------------------------------------------------------------
-- Scheduled checks
-- ---------------------------------------------------------------------------

select cron.schedule(
  'alert-checks',
  '*/5 * * * *',
  $$select private.invoke_edge_function('alert-checks', '{"job": "checks"}'::jsonb)$$
);

select cron.schedule(
  'alert-photos',
  '* * * * *',
  $$select private.invoke_edge_function('alert-checks', '{"job": "photos"}'::jsonb)$$
);

revoke all on function private.push_on_booking_schedule() from public;
revoke all on function private.push_on_visit_schedule() from public;
revoke all on function private.food_refusal_streak(uuid, timestamptz) from public;
revoke all on function private.push_on_food_refused() from public;
