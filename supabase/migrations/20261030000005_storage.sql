-- Private bucket for visit photos/videos and pet profile photos.
--
-- Paths:
--   {organization_id}/{visit_id}/{file}        visit media (sitters upload)
--   {organization_id}/pets/{pet_id}/{file}     pet profile photos (owners upload)
--
-- Files are served only through signed URLs; there are no public reads.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pet-media',
  'pet-media',
  false,
  52428800, -- 50 MiB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'video/mp4', 'video/quicktime']
)
on conflict (id) do nothing;

create function private.try_uuid(p_text text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_text::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

create function private.can_read_media_path(p_name text)
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

create function private.can_write_media_path(p_name text)
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
  if folders[2] = 'pets' and cardinality(folders) = 3 then
    return private.is_admin() or private.owns_pet(private.try_uuid(folders[3]));
  end if;
  if cardinality(folders) = 2 and private.try_uuid(folders[2]) is not null then
    return private.is_admin() or private.is_assigned_visit(private.try_uuid(folders[2]));
  end if;
  return false;
end;
$$;

revoke all on function private.try_uuid(text) from public;
revoke all on function private.can_read_media_path(text) from public;
revoke all on function private.can_write_media_path(text) from public;
grant execute on function private.try_uuid(text) to authenticated, service_role;
grant execute on function private.can_read_media_path(text) to authenticated, service_role;
grant execute on function private.can_write_media_path(text) to authenticated, service_role;

create policy "pet-media read" on storage.objects
  for select to authenticated
  using (bucket_id = 'pet-media' and private.can_read_media_path(name));

create policy "pet-media upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'pet-media' and private.can_write_media_path(name));

-- Uploaders can replace/remove their own files; admins can manage any file in their org.
create policy "pet-media update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'pet-media'
    and private.can_write_media_path(name)
    and (owner_id = (select auth.uid())::text or (select private.is_admin()))
  )
  with check (bucket_id = 'pet-media' and private.can_write_media_path(name));

create policy "pet-media delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'pet-media'
    and private.can_write_media_path(name)
    and (owner_id = (select auth.uid())::text or (select private.is_admin()))
  );
