-- Account deletion (required by Apple): make the data model deletable.
--
--   Owner deleted   → their households cascade: pets, bookings, visits, and now the
--                     visits' care events, media, and incidents too.
--   Sitter deleted  → visits keep their history; the sitter is detached
--                     (visits.sitter_id and created_by/sender_id become NULL).
--   Admin deleted   → handled by the delete-account Edge Function (last admin of a
--                     business with other members is refused).
--
-- This replaces the earlier ON DELETE RESTRICT on visit history.

-- Visit history follows its visit and pet.
alter table public.care_events
  drop constraint care_events_visit_id_organization_id_fkey,
  add constraint care_events_visit_id_organization_id_fkey
    foreign key (visit_id, organization_id) references public.visits (id, organization_id) on delete cascade,
  drop constraint care_events_pet_id_organization_id_fkey,
  add constraint care_events_pet_id_organization_id_fkey
    foreign key (pet_id, organization_id) references public.pets (id, organization_id) on delete cascade;

alter table public.media
  drop constraint media_visit_id_organization_id_fkey,
  add constraint media_visit_id_organization_id_fkey
    foreign key (visit_id, organization_id) references public.visits (id, organization_id) on delete cascade,
  drop constraint media_pet_id_organization_id_fkey,
  add constraint media_pet_id_organization_id_fkey
    foreign key (pet_id, organization_id) references public.pets (id, organization_id) on delete cascade;

alter table public.incidents
  drop constraint incidents_visit_id_organization_id_fkey,
  add constraint incidents_visit_id_organization_id_fkey
    foreign key (visit_id, organization_id) references public.visits (id, organization_id) on delete cascade,
  drop constraint incidents_pet_id_organization_id_fkey,
  add constraint incidents_pet_id_organization_id_fkey
    foreign key (pet_id, organization_id) references public.pets (id, organization_id) on delete cascade;

-- Authors can be deleted; their records stay, attributed to nobody.
alter table public.care_events
  alter column created_by drop not null,
  drop constraint care_events_created_by_organization_id_fkey,
  add constraint care_events_created_by_organization_id_fkey
    foreign key (created_by, organization_id) references public.profiles (id, organization_id)
    on delete set null (created_by);

alter table public.media
  alter column created_by drop not null,
  drop constraint media_created_by_organization_id_fkey,
  add constraint media_created_by_organization_id_fkey
    foreign key (created_by, organization_id) references public.profiles (id, organization_id)
    on delete set null (created_by);

alter table public.incidents
  alter column created_by drop not null,
  drop constraint incidents_created_by_organization_id_fkey,
  add constraint incidents_created_by_organization_id_fkey
    foreign key (created_by, organization_id) references public.profiles (id, organization_id)
    on delete set null (created_by);

alter table public.messages
  alter column sender_id drop not null,
  drop constraint messages_sender_id_organization_id_fkey,
  add constraint messages_sender_id_organization_id_fkey
    foreign key (sender_id, organization_id) references public.profiles (id, organization_id)
    on delete set null (sender_id);

-- Inserts must still name an author: NULL is only for "author deleted later".
create function private.require_author()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if to_jsonb(new) ->> tg_argv[0] is null then
    raise exception '%.% is required', tg_table_name, tg_argv[0] using errcode = '23502';
  end if;
  return new;
end;
$$;

create trigger require_author before insert on public.care_events
  for each row execute function private.require_author('created_by');
create trigger require_author before insert on public.media
  for each row execute function private.require_author('created_by');
create trigger require_author before insert on public.incidents
  for each row execute function private.require_author('created_by');
create trigger require_author before insert on public.messages
  for each row execute function private.require_author('sender_id');

