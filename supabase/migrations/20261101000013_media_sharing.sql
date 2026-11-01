-- Photo and video sharing: short videos, the pets in each photo, owner hearts,
-- offline-synced care events, and per-organization media retention.

-- ---------------------------------------------------------------------------
-- Videos (at most 15 seconds) and dimensions
-- ---------------------------------------------------------------------------

alter table public.media
  add column duration_seconds numeric(5, 2),
  add column width integer check (width > 0),
  add column height integer check (height > 0),
  -- A little slack: a 15 s recording can come out a few hundredths over.
  add constraint media_video_duration_check check (
    (type = 'video') = (duration_seconds is not null)
    and (duration_seconds is null or (duration_seconds > 0 and duration_seconds <= 15.5))
  );

-- ---------------------------------------------------------------------------
-- media_pets: which pets are in a photo or video
-- ---------------------------------------------------------------------------

create table public.media_pets (
  media_id uuid not null,
  pet_id uuid not null,
  organization_id uuid not null default private.current_org_id()
    references public.organizations (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (media_id, pet_id),
  foreign key (media_id, organization_id)
    references public.media (id, organization_id) on delete cascade,
  foreign key (pet_id, organization_id)
    references public.pets (id, organization_id) on delete cascade
);

create index media_pets_pet_id_idx on public.media_pets (pet_id, created_at);
create index media_pets_organization_id_idx on public.media_pets (organization_id);

-- The pet must be on the booking of the media's visit.
create function private.assert_media_pet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.media m
    join public.visits v on v.id = m.visit_id
    join public.booking_pets bp on bp.booking_id = v.booking_id
    where m.id = new.media_id and bp.pet_id = new.pet_id
  ) then
    raise exception 'Pet is not part of this visit''s booking' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger assert_media_pet
  before insert or update on public.media_pets
  for each row execute function private.assert_media_pet();

-- Existing media: the pet it names, or every pet on the visit.
insert into public.media_pets (media_id, pet_id, organization_id)
select m.id, m.pet_id, m.organization_id from public.media m where m.pet_id is not null
union
select m.id, bp.pet_id, m.organization_id
from public.media m
join public.visits v on v.id = m.visit_id
join public.booking_pets bp on bp.booking_id = v.booking_id
where m.pet_id is null;

-- Who can see a media item: admins of its org, the visit's owner, its sitter.
create function private.can_read_media(p_media_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.media m
    where m.id = p_media_id
      and m.organization_id = private.current_org_id()
      and (private.is_admin() or private.owns_visit(m.visit_id) or private.is_assigned_visit(m.visit_id))
  )
$$;

alter table public.media_pets enable row level security;
revoke all on public.media_pets from anon;

create policy "admins manage media_pets" on public.media_pets
  for all to authenticated
  using (organization_id = (select private.current_org_id()) and (select private.is_admin()))
  with check (organization_id = (select private.current_org_id()) and (select private.is_admin()));

create policy "visit members read media pets" on public.media_pets
  for select to authenticated
  using (private.can_read_media(media_id));

create policy "uploaders tag their media" on public.media_pets
  for insert to authenticated
  with check (
    organization_id = (select private.current_org_id())
    and exists (
      select 1 from public.media m
      where m.id = media_id and m.created_by = (select auth.uid()) and private.is_assigned_visit(m.visit_id)
    )
  );

create policy "uploaders untag their media" on public.media_pets
  for delete to authenticated
  using (
    exists (
      select 1 from public.media m
      where m.id = media_id and m.created_by = (select auth.uid()) and private.is_assigned_visit(m.visit_id)
    )
  );

-- ---------------------------------------------------------------------------
-- media_reactions: owners heart photos and videos
-- ---------------------------------------------------------------------------

create table public.media_reactions (
  media_id uuid not null,
  user_id uuid not null default auth.uid(),
  organization_id uuid not null default private.current_org_id()
    references public.organizations (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (media_id, user_id),
  foreign key (media_id, organization_id)
    references public.media (id, organization_id) on delete cascade,
  foreign key (user_id, organization_id)
    references public.profiles (id, organization_id) on delete cascade
);

create index media_reactions_organization_id_idx on public.media_reactions (organization_id);
create index media_reactions_user_id_idx on public.media_reactions (user_id);

alter table public.media_reactions enable row level security;
revoke all on public.media_reactions from anon;

create policy "admins read media_reactions" on public.media_reactions
  for select to authenticated
  using (organization_id = (select private.current_org_id()) and (select private.is_admin()));

create policy "visit members read reactions" on public.media_reactions
  for select to authenticated
  using (private.can_read_media(media_id));

create policy "owners heart their visit media" on public.media_reactions
  for insert to authenticated
  with check (
    organization_id = (select private.current_org_id())
    and user_id = (select auth.uid())
    and exists (
      select 1 from public.media m where m.id = media_id and private.owns_visit(m.visit_id)
    )
  );

create policy "owners remove their hearts" on public.media_reactions
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Care events synced after check-out (the sitter's offline queue)
-- ---------------------------------------------------------------------------
-- Same as 20261101000012, also accepting events that happened during the visit
-- but reached the server after check-out.

create or replace function private.assert_visit_open_for_care()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_client_non_admin() and not exists (
    select 1 from public.visits v
    where v.id = new.visit_id
      and (
        v.status in ('arrived', 'in_progress')
        or (
          v.status = 'completed'
          and new.occurred_at >= v.check_in_at
          and new.occurred_at < v.check_out_at
        )
      )
  ) then
    raise exception 'Check in before logging care' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Push for photos and videos, one per burst
-- ---------------------------------------------------------------------------
-- Sending ten photos at once notifies the owner once, not ten times.

create or replace function private.push_on_media_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.media
    where visit_id = new.visit_id and id <> new.id and created_at > now() - interval '2 minutes'
  ) then
    perform private.send_push_event(jsonb_build_object(
      'type', 'visit_photo', 'visit_id', new.visit_id, 'media_id', new.id, 'media_type', new.type
    ));
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Retention: auto-delete media older than N months (purge-old-media)
-- ---------------------------------------------------------------------------

alter table public.organizations
  add column media_retention_months integer check (media_retention_months between 1 and 120);

comment on column public.organizations.media_retention_months is
  'Visit photos and videos older than this are deleted nightly. Null keeps them.';

-- Media past its organization's retention, oldest first (service_role only).
create function public.list_expired_media(p_limit integer default 500)
returns table (id uuid, storage_path text, thumb_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.storage_path, m.thumb_path
  from public.media m
  join public.organizations o on o.id = m.organization_id
  where o.media_retention_months is not null
    and m.created_at < now() - make_interval(months => o.media_retention_months)
  order by m.created_at
  limit least(greatest(p_limit, 1), 1000)
$$;

revoke all on function public.list_expired_media(integer) from public, anon, authenticated;
grant execute on function public.list_expired_media(integer) to service_role;

-- 08:45 UTC daily.
select cron.schedule(
  'purge-old-media',
  '45 8 * * *',
  $$select private.invoke_edge_function('purge-old-media', '{}'::jsonb)$$
);

alter publication supabase_realtime add table public.media_reactions, public.media_pets;

revoke all on function private.assert_media_pet() from public;
revoke all on function private.can_read_media(uuid) from public;
grant execute on function private.can_read_media(uuid) to authenticated;
