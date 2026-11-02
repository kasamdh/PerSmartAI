-- In-app chat: one conversation per household.
--
-- Participants: the household's owner, the business's admins, and sitters with a
-- visit for the household in the last 30 or next 30 days. private.can_chat decides,
-- and every policy (messages, read state, chat photos in storage) uses it.
-- Read receipts are per person: conversation_reads.read_at is when that participant
-- last read the conversation.

-- ---------------------------------------------------------------------------
-- Who may take part
-- ---------------------------------------------------------------------------

create function private.can_chat(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.households h
    where h.id = p_household_id
      and h.organization_id = private.current_org_id()
      and (
        h.owner_id = (select auth.uid())
        or private.is_admin()
        or exists (
          select 1
          from public.visits v
          join public.bookings b on b.id = v.booking_id
          where b.household_id = h.id
            and v.sitter_id = (select auth.uid())
            and v.status <> 'cancelled'
            and v.scheduled_end >= now() - interval '30 days'
            and v.scheduled_start <= now() + interval '30 days'
        )
      )
  )
$$;

-- ---------------------------------------------------------------------------
-- messages: text and photos; read state moves to conversation_reads
-- ---------------------------------------------------------------------------

drop policy "participants read household messages" on public.messages;
drop policy "participants send household messages" on public.messages;
drop policy "participants mark household messages read" on public.messages;
drop policy "admins manage messages" on public.messages;

alter table public.messages
  drop constraint messages_check,
  drop column read_at,
  drop column media_id,
  add column photo_path text,
  add column photo_thumb_path text,
  add column photo_width integer check (photo_width > 0),
  add column photo_height integer check (photo_height > 0),
  add constraint messages_body_length check (char_length(body) <= 4000),
  add constraint messages_has_content check (coalesce(length(btrim(body)), 0) > 0 or photo_path is not null);

drop trigger guard_message_update on public.messages;
drop function private.guard_message_update();

-- Newest first, for pages of 30.
create index messages_household_page_idx on public.messages (household_id, created_at desc, id desc);

create policy "participants read messages" on public.messages
  for select to authenticated
  using (organization_id = (select private.current_org_id()) and private.can_chat(household_id));

-- require_author (20261031000006) already forces sender_id = the signed-in user.
create policy "participants send messages" on public.messages
  for insert to authenticated
  with check (
    organization_id = (select private.current_org_id())
    and sender_id = (select auth.uid())
    and private.can_chat(household_id)
  );

-- Messages are a record: nobody edits them; senders and admins may delete.
create policy "senders and admins delete messages" on public.messages
  for delete to authenticated
  using (
    organization_id = (select private.current_org_id())
    and (sender_id = (select auth.uid()) or (select private.is_admin()))
  );

-- Chat photos must be in this household's chat folder.
create function private.assert_message_photo_path()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.photo_path is not null and (
    new.photo_path not like new.organization_id || '/chat/' || new.household_id || '/%'
    or (new.photo_thumb_path is not null
        and new.photo_thumb_path not like new.organization_id || '/chat/' || new.household_id || '/%')
  ) then
    raise exception 'Chat photos belong in the household''s chat folder' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger assert_message_photo_path
  before insert on public.messages
  for each row execute function private.assert_message_photo_path();

-- ---------------------------------------------------------------------------
-- conversation_reads: each participant's read_at per household
-- ---------------------------------------------------------------------------

create table public.conversation_reads (
  household_id uuid not null,
  user_id uuid not null default auth.uid(),
  organization_id uuid not null default private.current_org_id()
    references public.organizations (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (household_id, user_id),
  foreign key (household_id, organization_id)
    references public.households (id, organization_id) on delete cascade,
  foreign key (user_id, organization_id)
    references public.profiles (id, organization_id) on delete cascade
);

create index conversation_reads_organization_id_idx on public.conversation_reads (organization_id);
create index conversation_reads_user_id_idx on public.conversation_reads (user_id);

alter table public.conversation_reads enable row level security;
revoke all on public.conversation_reads from anon;

-- Participants see each other's read state (read receipts).
create policy "participants see read receipts" on public.conversation_reads
  for select to authenticated
  using (organization_id = (select private.current_org_id()) and private.can_chat(household_id));

create policy "participants mark read" on public.conversation_reads
  for insert to authenticated
  with check (
    organization_id = (select private.current_org_id())
    and user_id = (select auth.uid())
    and private.can_chat(household_id)
  );

create policy "participants update their read state" on public.conversation_reads
  for update to authenticated
  using (user_id = (select auth.uid()) and private.can_chat(household_id))
  with check (user_id = (select auth.uid()) and private.can_chat(household_id));

-- read_at only moves forward (a stale device can't un-read).
create function private.keep_latest_read()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.read_at := greatest(new.read_at, old.read_at);
  return new;
end;
$$;

create trigger keep_latest_read
  before update on public.conversation_reads
  for each row execute function private.keep_latest_read();

-- ---------------------------------------------------------------------------
-- Conversation list and unread counts (security invoker: RLS applies)
-- ---------------------------------------------------------------------------

create function public.my_conversations()
returns table (
  household_id uuid,
  household_name text,
  owner_name text,
  last_message_at timestamptz,
  last_message_body text,
  last_message_has_photo boolean,
  last_sender_name text,
  unread integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select h.id,
         coalesce(h.name, h.address_line1),
         owner.full_name,
         last.created_at,
         last.body,
         last.photo_path is not null,
         sender.full_name,
         (select count(*)::int from public.messages m
          where m.household_id = h.id
            and m.sender_id is distinct from (select auth.uid())
            and m.created_at > coalesce(r.read_at, '-infinity'))
  from public.households h
  left join public.profiles owner on owner.id = h.owner_id
  left join public.conversation_reads r on r.household_id = h.id and r.user_id = (select auth.uid())
  left join lateral (
    select m.created_at, m.body, m.photo_path, m.sender_id
    from public.messages m
    where m.household_id = h.id
    order by m.created_at desc, m.id desc
    limit 1
  ) last on true
  left join public.profiles sender on sender.id = last.sender_id
  where private.can_chat(h.id)
  order by last.created_at desc nulls last, coalesce(h.name, h.address_line1)
$$;

create function public.unread_message_count()
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::int
  from public.messages m
  left join public.conversation_reads r
    on r.household_id = m.household_id and r.user_id = (select auth.uid())
  where m.sender_id is distinct from (select auth.uid())
    and m.created_at > coalesce(r.read_at, '-infinity')
    and private.can_chat(m.household_id)
$$;

revoke all on function public.my_conversations() from public, anon;
grant execute on function public.my_conversations() to authenticated;
revoke all on function public.unread_message_count() from public, anon;
grant execute on function public.unread_message_count() to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: chat photos at {org}/chat/{household_id}/{file}
-- ---------------------------------------------------------------------------
-- Same as 20261030000005, adding the chat folder for conversation participants.

create or replace function private.can_read_media_path(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  folders text[] := storage.foldername(p_name);
begin
  if private.try_uuid(folders[1]) is distinct from private.current_org_id() then
    return false;
  end if;
  if folders[2] = 'chat' and cardinality(folders) = 3 then
    return private.can_chat(private.try_uuid(folders[3]));
  end if;
  if private.is_admin() then
    return true;
  end if;
  if folders[2] = 'pets' and cardinality(folders) = 3 then
    return private.owns_pet(private.try_uuid(folders[3]))
        or private.sitter_can_access_pet(private.try_uuid(folders[3]));
  end if;
  if cardinality(folders) = 2 then
    return private.owns_visit(private.try_uuid(folders[2]))
        or private.is_assigned_visit(private.try_uuid(folders[2]));
  end if;
  return false;
end;
$$;

create or replace function private.can_write_media_path(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  folders text[] := storage.foldername(p_name);
begin
  if private.try_uuid(folders[1]) is distinct from private.current_org_id() then
    return false;
  end if;
  if folders[2] = 'chat' and cardinality(folders) = 3 then
    return private.can_chat(private.try_uuid(folders[3]));
  end if;
  if folders[2] = 'pets' and cardinality(folders) = 3 then
    return private.is_admin() or private.owns_pet(private.try_uuid(folders[3]));
  end if;
  if cardinality(folders) = 2 and private.try_uuid(folders[2]) is not null then
    return private.is_admin() or private.is_assigned_visit(private.try_uuid(folders[2]));
  end if;
  return false;
end;
$$;

-- ---------------------------------------------------------------------------
-- Push: the first message pushes right away; quick follow-ups are batched
-- ---------------------------------------------------------------------------
-- notify-owner sends at once unless the conversation had an alert in the last
-- minute; alert-checks (every minute) sends what's left as one alert.

create function private.push_on_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.send_push_event(jsonb_build_object(
    'type', 'message', 'household_id', new.household_id, 'message_id', new.id
  ));
  return null;
end;
$$;

create trigger push_on_message
  after insert on public.messages
  for each row execute function private.push_on_message();

alter publication supabase_realtime add table public.messages, public.conversation_reads;

revoke all on function private.can_chat(uuid) from public;
grant execute on function private.can_chat(uuid) to authenticated, service_role;
revoke all on function private.assert_message_photo_path() from public;
revoke all on function private.keep_latest_read() from public;
revoke all on function private.push_on_message() from public;
