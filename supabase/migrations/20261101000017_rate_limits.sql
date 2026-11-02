-- Rate limits for public endpoints that could be brute-forced.
--
-- Sign-in, sign-up, magic links and the 6-digit email codes are limited by
-- Supabase Auth ([auth.rate_limit] in config.toml; set the same in the hosted
-- dashboard). Auth can't see check_invite, the one RPC anonymous users can call,
-- so it gets its own per-IP limit here.

create table private.rate_limits (
  bucket text not null,
  subject text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, subject, window_start)
);

-- Only these security definer functions touch it.
revoke all on private.rate_limits from public, anon, authenticated;

-- The caller's IP as the API gateway saw it. Hosted Supabase sits behind
-- Cloudflare, which sets cf-connecting-ip (clients can't forge it). Otherwise use
-- the last X-Forwarded-For hop, the one added by the gateway; earlier hops come
-- from the client and can be anything.
create function private.request_ip()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(trim(h ->> 'cf-connecting-ip'), ''),
    nullif(trim((regexp_split_to_array(h ->> 'x-forwarded-for', ','))[
      cardinality(regexp_split_to_array(h ->> 'x-forwarded-for', ','))
    ]), ''),
    'unknown'
  )
  from (select coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json as h) r
$$;

-- Counts a hit for (bucket, subject) in a fixed window and refuses with HTTP 429
-- (PostgREST maps SQLSTATE PT429) once more than max_hits are made. The refused
-- call rolls back, so the count stays at the limit until the window passes.
create function private.hit_rate_limit(
  p_bucket text,
  p_subject text,
  p_max_hits integer,
  p_window interval
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  win timestamptz := to_timestamp(
    floor(extract(epoch from now()) / extract(epoch from p_window)) * extract(epoch from p_window)
  );
  total integer;
begin
  insert into private.rate_limits as r (bucket, subject, window_start, hits)
  values (p_bucket, p_subject, win, 1)
  on conflict (bucket, subject, window_start) do update set hits = r.hits + 1
  returning hits into total;

  if total > p_max_hits then
    raise exception 'Too many attempts. Please wait a few minutes and try again.'
      using errcode = 'PT429';
  end if;
end;
$$;

revoke all on function private.hit_rate_limit(text, text, integer, interval) from public;
revoke all on function private.request_ip() from public;

-- 10 invite lookups per IP per 10 minutes. Codes are 8 characters from a
-- 31-letter alphabet (~8.5e11), so guessing one at that rate is hopeless.
create or replace function public.check_invite(p_code text)
returns table (organization_name text, role public.app_role, email_locked boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.hit_rate_limit('check_invite', private.request_ip(), 10, interval '10 minutes');
  return query
    select o.name, i.role, i.email is not null
    from public.invites i
    join public.organizations o on o.id = i.organization_id
    where i.code = upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g'))
      and i.accepted_at is null
      and i.expires_at > now();
end;
$$;

revoke all on function public.check_invite(text) from public;
grant execute on function public.check_invite(text) to anon, authenticated;

-- Old windows are useless; clear them hourly.
select cron.schedule(
  'purge-rate-limits',
  '7 * * * *',
  $$delete from private.rate_limits where window_start < now() - interval '1 day'$$
);
