-- Time off is requested by sitters and approved or declined by admins.
-- Only approved time off blocks scheduling; requested time off is a warning.

create type public.time_off_status as enum ('requested', 'approved', 'declined');

-- Existing rows were entered before approval existed; keep them in force.
alter table public.sitter_time_off
  add column status public.time_off_status not null default 'approved',
  add column reviewed_at timestamptz;
alter table public.sitter_time_off alter column status set default 'requested';

create index sitter_time_off_org_status_idx on public.sitter_time_off (organization_id, status);

-- Sitters (RLS: only their own rows) may request time off, edit or withdraw a
-- request that's still pending, and withdraw approved time off that hasn't started.
-- Only admins set the status.
create function private.guard_time_off_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_client_non_admin() then
    if tg_op = 'UPDATE' and new.status is distinct from old.status then
      new.reviewed_at := now();
    end if;
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'requested' or new.reviewed_at is not null then
      raise exception 'Time off starts as a request' using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.status <> 'requested' then
      raise exception 'Only pending requests can be changed' using errcode = '42501';
    end if;
    if new.status is distinct from old.status or new.reviewed_at is distinct from old.reviewed_at then
      raise exception 'Only an admin can approve or decline time off' using errcode = '42501';
    end if;
    return new;
  end if;

  -- DELETE
  if old.status = 'approved' and old.start_at <= now() then
    raise exception 'Time off that has started can''t be withdrawn' using errcode = '42501';
  end if;
  return old;
end;
$$;

create trigger guard_time_off_write
  before insert or update or delete on public.sitter_time_off
  for each row execute function private.guard_time_off_write();

revoke all on function private.guard_time_off_write() from public;
