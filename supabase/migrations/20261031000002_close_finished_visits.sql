-- Sitters may not reopen or edit a visit once it is completed, missed, or
-- cancelled (e.g. checking back in after checking out). Admins still can.

create or replace function private.guard_visit_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sitter_fields constant text[] := array[
    'status', 'check_in_at', 'check_in_lat', 'check_in_lng',
    'check_out_at', 'check_out_lat', 'check_out_lng', 'summary_note', 'updated_at'
  ];
begin
  if not private.is_client_non_admin() then
    return new;
  end if;
  if old.status in ('completed', 'missed', 'cancelled') then
    raise exception 'This visit is closed and can no longer be changed' using errcode = '42501';
  end if;
  if (to_jsonb(new) - sitter_fields) <> (to_jsonb(old) - sitter_fields) then
    raise exception 'Sitters can only update status, check-in/out, and summary'
      using errcode = '42501';
  end if;
  if new.status is distinct from old.status
     and new.status not in ('on_the_way', 'arrived', 'in_progress', 'completed') then
    raise exception 'Sitters cannot set visit status to %', new.status using errcode = '42501';
  end if;
  return new;
end;
$$;
