-- White-label branding (used by the mobile app) and resolvable incidents (the
-- admin dashboard's "open incidents").

-- ---------------------------------------------------------------------------
-- Branding: logo and colors, edited in the admin web app
-- ---------------------------------------------------------------------------

alter table public.organizations
  add column logo_path text,
  add column primary_color text check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column accent_color text check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint organizations_logo_path_check
    check (logo_path is null or logo_path like id::text || '/branding/%');

-- Storage: {org}/branding/{file}: every member reads, admins write.
-- Same as 20261101000015, adding the branding folder.
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
  if folders[2] = 'branding' and cardinality(folders) = 2 then
    return true;
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
  if folders[2] = 'branding' and cardinality(folders) = 2 then
    return private.is_admin();
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
-- Incidents: open until an admin resolves them
-- ---------------------------------------------------------------------------

alter table public.incidents
  add column resolved_at timestamptz,
  add column resolved_by uuid,
  add column resolution_note text check (char_length(resolution_note) <= 2000),
  add constraint incidents_resolved_by_fkey foreign key (resolved_by, organization_id)
    references public.profiles (id, organization_id) on delete set null (resolved_by);

create index incidents_open_idx on public.incidents (organization_id, created_at)
  where resolved_at is null;

-- Sitters may edit their own report, but only admins resolve incidents.
create function private.guard_incident_resolution()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_admin() then
    if new.resolved_at is not null and old.resolved_at is null then
      new.resolved_by := coalesce(new.resolved_by, (select auth.uid()));
    end if;
    return new;
  end if;
  if (select auth.uid()) is not null and (
       new.resolved_at is distinct from old.resolved_at
       or new.resolved_by is distinct from old.resolved_by
       or new.resolution_note is distinct from old.resolution_note
     ) then
    raise exception 'Only an admin can resolve incidents' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard_incident_resolution
  before update on public.incidents
  for each row execute function private.guard_incident_resolution();

revoke all on function private.guard_incident_resolution() from public;
