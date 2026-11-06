-- =============================================================================
-- MUSICED · 0100 · Foundation
-- Extensions, shared enums, the `private` schema for internal functions, and
-- generic trigger helpers used by every later migration.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- Internal functions (trigger bodies, counters) live here. The schema is NOT
-- exposed through the Data API, so nothing in it is callable by clients.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Shared enums
-- -----------------------------------------------------------------------------
create type public.visibility as enum ('public', 'followers', 'private');

create type public.user_role as enum ('user', 'moderator', 'admin');

-- Album-level type, mapped from MusicBrainz release-group primary/secondary types.
create type public.album_type as enum (
  'album', 'ep', 'single', 'compilation', 'live', 'soundtrack',
  'remix', 'mixtape', 'broadcast', 'other'
);

-- -----------------------------------------------------------------------------
-- Generic helpers
-- -----------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
