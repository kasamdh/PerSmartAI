-- Make one emergency contact the household's primary, atomically.
-- SECURITY INVOKER: RLS applies, so only the household's owner (or an admin) can do it.

create function public.set_primary_emergency_contact(p_contact_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_household uuid;
begin
  select household_id into v_household
  from public.emergency_contacts
  where id = p_contact_id;

  if v_household is null then
    raise exception 'Contact not found' using errcode = 'P0002';
  end if;

  -- Clear first so the one-primary unique index never sees two.
  update public.emergency_contacts
     set is_primary = false
   where household_id = v_household and is_primary and id <> p_contact_id;

  update public.emergency_contacts set is_primary = true where id = p_contact_id;
  if not found then
    raise exception 'Not allowed to change this contact' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.set_primary_emergency_contact(uuid) from public, anon;
grant execute on function public.set_primary_emergency_contact(uuid) to authenticated;
