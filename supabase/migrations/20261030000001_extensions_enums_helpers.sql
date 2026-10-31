-- Extensions, enums, and generic trigger functions.
--
-- Helper functions live in the `private` schema, which is NOT exposed through the
-- Supabase API (see api.schemas in config.toml). Policies can call them, clients can't.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.app_role as enum ('owner', 'sitter', 'admin');
create type public.pet_species as enum ('dog', 'cat');
create type public.pet_sex as enum ('male', 'female', 'unknown');
create type public.allergy_severity as enum ('mild', 'moderate', 'severe');
create type public.service_type as enum ('drop_in', 'walk', 'overnight', 'multi_day');
create type public.booking_status as enum ('requested', 'confirmed', 'declined', 'cancelled', 'completed');
create type public.visit_status as enum (
  'scheduled', 'on_the_way', 'arrived', 'in_progress', 'completed', 'missed', 'cancelled'
);
create type public.care_event_type as enum (
  'fed', 'water', 'pee', 'poop', 'walk', 'meds_given', 'play', 'vomit', 'note'
);
create type public.media_type as enum ('photo', 'video');
create type public.incident_severity as enum ('minor', 'moderate', 'severe', 'emergency');
create type public.push_platform as enum ('ios', 'android', 'web');

-- ---------------------------------------------------------------------------
-- Generic trigger functions (no table dependencies)
-- ---------------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Rejects time zone names Postgres doesn't know (e.g. 'America/New_Yrok').
create function private.validate_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform now() at time zone new.timezone;
  return new;
exception
  when invalid_parameter_value then
    raise exception 'Unknown time zone: %', new.timezone using errcode = '22023';
end;
$$;
