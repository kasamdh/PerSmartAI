-- Push notifications: visit status changes, new photos, and incidents call the
-- notify-owner Edge Function asynchronously via pg_net.
--
-- Configuration lives in Supabase Vault, never in migrations:
--   edge_functions_url  e.g. https://<project-ref>.supabase.co/functions/v1
--   service_role_key    the project's service_role JWT
-- If either secret is missing, no request is sent (safe for CI and fresh projects).
-- Local values are set in supabase/seed.sql.

create extension if not exists pg_net with schema extensions;

create function private.send_push_event(p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_url text;
  service_key text;
begin
  select decrypted_secret into base_url
  from vault.decrypted_secrets where name = 'edge_functions_url';
  select decrypted_secret into service_key
  from vault.decrypted_secrets where name = 'service_role_key';

  if base_url is null or service_key is null then
    return;
  end if;

  -- pg_net queues the request and sends it after commit; a failure never blocks the write.
  perform net.http_post(
    url := base_url || '/notify-owner',
    body := p_payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    timeout_milliseconds := 5000
  );
end;
$$;

create function private.push_on_visit_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('on_the_way', 'in_progress', 'completed') then
    perform private.send_push_event(jsonb_build_object(
      'type', 'visit_status', 'visit_id', new.id, 'status', new.status
    ));
  end if;
  return null;
end;
$$;

create trigger push_on_visit_status
  after update of status on public.visits
  for each row execute function private.push_on_visit_status();

create function private.push_on_media_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type = 'photo' then
    perform private.send_push_event(jsonb_build_object(
      'type', 'visit_photo', 'visit_id', new.visit_id, 'media_id', new.id
    ));
  end if;
  return null;
end;
$$;

create trigger push_on_media_insert
  after insert on public.media
  for each row execute function private.push_on_media_insert();

create function private.push_on_incident_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.send_push_event(jsonb_build_object(
    'type', 'incident', 'visit_id', new.visit_id, 'incident_id', new.id
  ));
  return null;
end;
$$;

create trigger push_on_incident_insert
  after insert on public.incidents
  for each row execute function private.push_on_incident_insert();

revoke all on function private.send_push_event(jsonb) from public, authenticated;
