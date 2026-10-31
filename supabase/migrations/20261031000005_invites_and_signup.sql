-- Invites and sign-up.
--
-- New users get a profile from a trigger on auth.users, based on the metadata the
-- app sends with signUp():
--   { signup_type: 'business', business_name, timezone, full_name }  → new org + admin
--   { invite_code, full_name, phone? }                               → joins invite's org/role
-- Anything else (e.g. seed users, dashboard-created users) gets no profile; the app
-- shows "account not set up".

-- ---------------------------------------------------------------------------
-- invites
-- ---------------------------------------------------------------------------

-- 8 characters from an alphabet without look-alikes (no 0/O, 1/I/L).
create function private.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(8);
  code text := '';
begin
  for i in 0..7 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return code;
end;
$$;

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_org_id()
    references public.organizations (id) on delete cascade,
  email text check (email is null or email = lower(trim(email))),
  role public.app_role not null check (role in ('owner', 'sitter')),
  code text not null unique default private.generate_invite_code()
    check (code ~ '^[A-Z2-9]{8}$'),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (created_by, organization_id)
    references public.profiles (id, organization_id) on delete set null (created_by)
);

create index invites_organization_id_idx on public.invites (organization_id, created_at desc);
create index invites_accepted_by_idx on public.invites (accepted_by);
create index invites_created_by_idx on public.invites (created_by);

create trigger set_updated_at
  before update on public.invites
  for each row execute function private.set_updated_at();

alter table public.invites enable row level security;
revoke all on public.invites from anon;

-- Only admins see or manage invites. Invitees look codes up via check_invite().
create policy "admins manage invites" on public.invites
  for all to authenticated
  using (organization_id = (select private.current_org_id()) and (select private.is_admin()))
  with check (organization_id = (select private.current_org_id()) and (select private.is_admin()));

-- Public lookup for the Accept invite screen: reveals only the business name, the
-- role, and whether the invite is locked to an email, and only for a usable code.
create function public.check_invite(p_code text)
returns table (organization_name text, role public.app_role, email_locked boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select o.name, i.role, i.email is not null
  from public.invites i
  join public.organizations o on o.id = i.organization_id
  where i.code = upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g'))
    and i.accepted_at is null
    and i.expires_at > now()
$$;

revoke all on function public.check_invite(text) from public;
grant execute on function public.check_invite(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Profile creation on sign-up
-- ---------------------------------------------------------------------------

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  full_name text := coalesce(nullif(trim(meta ->> 'full_name'), ''), split_part(new.email, '@', 1));
  phone text := nullif(trim(meta ->> 'phone'), '');
  invite public.invites;
  org_id uuid;
begin
  if meta ? 'invite_code' then
    select * into invite
    from public.invites
    where code = upper(regexp_replace(meta ->> 'invite_code', '[^A-Za-z0-9]', '', 'g'))
      and accepted_at is null
      and expires_at > now()
    for update;

    if not found then
      raise exception 'Invite code is invalid, expired, or already used' using errcode = 'P0001';
    end if;
    if invite.email is not null and invite.email <> lower(new.email) then
      raise exception 'This invite is for a different email address' using errcode = 'P0001';
    end if;

    insert into public.profiles (id, organization_id, role, full_name, phone)
    values (new.id, invite.organization_id, invite.role, full_name, phone);

    update public.invites set accepted_at = now(), accepted_by = new.id where id = invite.id;

  elsif meta ->> 'signup_type' = 'business' then
    if nullif(trim(meta ->> 'business_name'), '') is null then
      raise exception 'Business name is required' using errcode = 'P0001';
    end if;

    insert into public.organizations (name, timezone)
    values (trim(meta ->> 'business_name'), coalesce(nullif(meta ->> 'timezone', ''), 'UTC'))
    returning id into org_id;

    insert into public.profiles (id, organization_id, role, full_name, phone)
    values (new.id, org_id, 'admin', full_name, phone);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
