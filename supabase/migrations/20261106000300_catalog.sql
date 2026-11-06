-- =============================================================================
-- MUSICED · 0300 · Music catalog
-- Albums are modelled on MusicBrainz *release groups*. A representative
-- release (for tracklist/label) is recorded in catalog_sources.
--
-- The catalog is read-only to clients. It is written exclusively by the
-- server-side ingestion layer (src/lib/music-providers) using the service role.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- artists
-- -----------------------------------------------------------------------------
create table public.artists (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name            text not null,
  sort_name       text,
  disambiguation  text,
  artist_type     text,
  country         text,
  begin_date      text,
  end_date        text,
  image_url       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  synced_at       timestamptz,

  constraint artists_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 140),
  constraint artists_name_length check (char_length(name) between 1 and 500),
  constraint artists_country_format check (country is null or country ~ '^[A-Z]{2}$'),
  constraint artists_begin_date_format check (begin_date is null or begin_date ~ '^\d{4}(-\d{2}(-\d{2})?)?$'),
  constraint artists_end_date_format check (end_date is null or end_date ~ '^\d{4}(-\d{2}(-\d{2})?)?$')
);

create index artists_name_trgm_idx on public.artists using gin (name extensions.gin_trgm_ops);

create trigger artists_set_updated_at
  before update on public.artists
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- albums (release groups)
-- -----------------------------------------------------------------------------
create table public.albums (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  title             text not null,
  -- Display credit preserving join phrases, e.g. "Simon & Garfunkel".
  artist_credit     text not null,
  album_type        public.album_type not null default 'album',
  secondary_types   text[] not null default '{}',
  release_date      text,
  release_year      smallint,
  label             text,
  country           text,
  cover_url         text,
  cover_status      text not null default 'unknown',
  track_count       smallint,
  duration_ms       integer,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  synced_at         timestamptz,
  tracks_synced_at  timestamptz,

  constraint albums_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 200),
  constraint albums_title_length check (char_length(title) between 1 and 500),
  constraint albums_release_date_format check (release_date is null or release_date ~ '^\d{4}(-\d{2}(-\d{2})?)?$'),
  constraint albums_release_year_range check (release_year is null or release_year between 1000 and 3000),
  constraint albums_cover_status check (cover_status in ('unknown', 'available', 'missing')),
  constraint albums_country_format check (country is null or country ~ '^[A-Z]{2}$'),
  constraint albums_track_count_positive check (track_count is null or track_count >= 0),
  constraint albums_duration_positive check (duration_ms is null or duration_ms >= 0)
);

create index albums_title_trgm_idx on public.albums using gin (title extensions.gin_trgm_ops);
create index albums_artist_credit_trgm_idx on public.albums using gin (artist_credit extensions.gin_trgm_ops);
create index albums_release_year_idx on public.albums (release_year desc nulls last);
create index albums_created_at_idx on public.albums (created_at desc);

create trigger albums_set_updated_at
  before update on public.albums
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- album_artists (multi-artist credits, ordered)
-- -----------------------------------------------------------------------------
create table public.album_artists (
  album_id       uuid not null references public.albums (id) on delete cascade,
  artist_id      uuid not null references public.artists (id) on delete restrict,
  position       smallint not null check (position >= 0),
  credited_name  text,
  join_phrase    text not null default '',
  primary key (album_id, position),
  unique (album_id, artist_id)
);

create index album_artists_artist_idx on public.album_artists (artist_id);

-- -----------------------------------------------------------------------------
-- tracks (from the representative release)
-- -----------------------------------------------------------------------------
create table public.tracks (
  id              uuid primary key default gen_random_uuid(),
  album_id        uuid not null references public.albums (id) on delete cascade,
  disc_number     smallint not null default 1 check (disc_number >= 1),
  position        smallint not null check (position >= 1),
  number          text,
  title           text not null check (char_length(title) between 1 and 500),
  duration_ms     integer check (duration_ms is null or duration_ms >= 0),
  recording_mbid  uuid,
  created_at      timestamptz not null default now(),
  unique (album_id, disc_number, position)
);

-- -----------------------------------------------------------------------------
-- genres
-- `is_featured` marks the curated top-level genres offered during onboarding.
-- -----------------------------------------------------------------------------
create table public.genres (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name         text not null check (char_length(name) between 1 and 80),
  parent_id    uuid references public.genres (id) on delete set null,
  description  text,
  is_featured  boolean not null default false,
  sort_order   smallint not null default 0,
  created_at   timestamptz not null default now()
);

create index genres_parent_idx on public.genres (parent_id);
create index genres_name_trgm_idx on public.genres using gin (name extensions.gin_trgm_ops);

create table public.album_genres (
  album_id  uuid not null references public.albums (id) on delete cascade,
  genre_id  uuid not null references public.genres (id) on delete cascade,
  -- Provider vote count / relevance weight; higher is more representative.
  weight    integer not null default 1 check (weight >= 0),
  primary key (album_id, genre_id)
);

create index album_genres_genre_idx on public.album_genres (genre_id, weight desc);

-- -----------------------------------------------------------------------------
-- user_favorite_genres (taste profile, chosen during onboarding)
-- -----------------------------------------------------------------------------
create table public.user_favorite_genres (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  genre_id    uuid not null references public.genres (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, genre_id)
);

create index user_favorite_genres_genre_idx on public.user_favorite_genres (genre_id);

-- Keep a taste profile focused.
create or replace function private.limit_favorite_genres()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.user_favorite_genres where user_id = new.user_id) >= 12 then
    raise exception 'You can pick up to 12 favorite genres' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger user_favorite_genres_limit
  before insert on public.user_favorite_genres
  for each row execute function private.limit_favorite_genres();

-- -----------------------------------------------------------------------------
-- catalog_sources
-- Maps local entities to external provider identifiers (MusicBrainz MBIDs,
-- Last.fm URLs, ...). The unique constraints are what prevent duplicate
-- catalog records when the same entity is ingested twice.
-- -----------------------------------------------------------------------------
create table public.catalog_sources (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null,
  entity_id    uuid not null,
  provider     text not null,
  external_id  text not null,
  url          text,
  fetched_at   timestamptz not null default now(),
  created_at   timestamptz not null default now(),

  constraint catalog_sources_entity_type check (entity_type in ('artist', 'album', 'release', 'track')),
  constraint catalog_sources_provider_format check (provider ~ '^[a-z0-9_]{2,32}$'),
  constraint catalog_sources_external_unique unique (provider, entity_type, external_id),
  constraint catalog_sources_entity_unique unique (entity_type, entity_id, provider)
);

create index catalog_sources_entity_idx on public.catalog_sources (entity_type, entity_id);

-- Polymorphic rows have no FK; clean them up when the entity disappears.
create or replace function private.delete_catalog_sources()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'albums' then
    delete from public.catalog_sources
    where entity_id = old.id and entity_type in ('album', 'release');
  elsif tg_table_name = 'artists' then
    delete from public.catalog_sources where entity_id = old.id and entity_type = 'artist';
  end if;
  return old;
end;
$$;

create trigger albums_delete_catalog_sources
  after delete on public.albums
  for each row execute function private.delete_catalog_sources();

create trigger artists_delete_catalog_sources
  after delete on public.artists
  for each row execute function private.delete_catalog_sources();

-- -----------------------------------------------------------------------------
-- album_stats
-- Aggregates maintained by triggers on user tables (see 0400). Never written
-- by clients. Histogram index i (1..10) counts ratings of i/2 stars.
-- -----------------------------------------------------------------------------
create table public.album_stats (
  album_id          uuid primary key references public.albums (id) on delete cascade,
  ratings_count     integer not null default 0 check (ratings_count >= 0),
  ratings_sum       numeric(12, 1) not null default 0,
  rating_histogram  integer[] not null default array_fill(0, array[10]),
  average_rating    numeric(3, 2) generated always as (
    case when ratings_count > 0 then round(ratings_sum / ratings_count, 2) end
  ) stored,
  reviews_count     integer not null default 0 check (reviews_count >= 0),
  logs_count        integer not null default 0 check (logs_count >= 0),
  favorites_count   integer not null default 0 check (favorites_count >= 0),
  last_activity_at  timestamptz,
  updated_at        timestamptz not null default now(),
  constraint album_stats_histogram_size check (array_length(rating_histogram, 1) = 10)
);

create index album_stats_average_idx on public.album_stats (average_rating desc nulls last)
  where ratings_count > 0;
create index album_stats_ratings_count_idx on public.album_stats (ratings_count desc);
create index album_stats_last_activity_idx on public.album_stats (last_activity_at desc nulls last);

-- -----------------------------------------------------------------------------
-- provider_cache
-- Short-lived cache of external API responses (search results, lookups) to
-- avoid hammering MusicBrainz. Server-only: RLS enabled with no policies.
-- -----------------------------------------------------------------------------
create table public.provider_cache (
  cache_key   text primary key check (char_length(cache_key) <= 512),
  provider    text not null,
  payload     jsonb not null,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index provider_cache_expires_idx on public.provider_cache (expires_at);

-- -----------------------------------------------------------------------------
-- Privileges + RLS
-- -----------------------------------------------------------------------------
revoke all on table
  public.artists, public.albums, public.album_artists, public.tracks, public.genres,
  public.album_genres, public.user_favorite_genres, public.catalog_sources,
  public.album_stats, public.provider_cache
from anon, authenticated;

grant select on table
  public.artists, public.albums, public.album_artists, public.tracks, public.genres,
  public.album_genres, public.catalog_sources, public.album_stats
to anon, authenticated;

grant select on table public.user_favorite_genres to anon, authenticated;
grant insert (user_id, genre_id), delete on table public.user_favorite_genres to authenticated;

alter table public.artists enable row level security;
alter table public.albums enable row level security;
alter table public.album_artists enable row level security;
alter table public.tracks enable row level security;
alter table public.genres enable row level security;
alter table public.album_genres enable row level security;
alter table public.user_favorite_genres enable row level security;
alter table public.catalog_sources enable row level security;
alter table public.album_stats enable row level security;
alter table public.provider_cache enable row level security;

create policy "Catalog is public" on public.artists for select to anon, authenticated using (true);
create policy "Catalog is public" on public.albums for select to anon, authenticated using (true);
create policy "Catalog is public" on public.album_artists for select to anon, authenticated using (true);
create policy "Catalog is public" on public.tracks for select to anon, authenticated using (true);
create policy "Catalog is public" on public.genres for select to anon, authenticated using (true);
create policy "Catalog is public" on public.album_genres for select to anon, authenticated using (true);
create policy "Catalog is public" on public.catalog_sources for select to anon, authenticated using (true);
create policy "Album stats are public" on public.album_stats for select to anon, authenticated using (true);

create policy "Favorite genres are public"
  on public.user_favorite_genres for select
  to anon, authenticated
  using (true);

create policy "Users add their own favorite genres"
  on public.user_favorite_genres for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users remove their own favorite genres"
  on public.user_favorite_genres for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- provider_cache: intentionally no policies (service role only).

-- -----------------------------------------------------------------------------
-- Reference data: curated top-level genres for onboarding and browsing.
-- This is taxonomy, not user data, so it belongs in a migration.
-- -----------------------------------------------------------------------------
insert into public.genres (slug, name, is_featured, sort_order) values
  ('rock', 'Rock', true, 10),
  ('hip-hop', 'Hip Hop', true, 20),
  ('pop', 'Pop', true, 30),
  ('electronic', 'Electronic', true, 40),
  ('jazz', 'Jazz', true, 50),
  ('r-and-b', 'R&B', true, 60),
  ('soul', 'Soul', true, 70),
  ('indie', 'Indie', true, 80),
  ('alternative', 'Alternative', true, 90),
  ('metal', 'Metal', true, 100),
  ('punk', 'Punk', true, 110),
  ('folk', 'Folk', true, 120),
  ('country', 'Country', true, 130),
  ('classical', 'Classical', true, 140),
  ('ambient', 'Ambient', true, 150),
  ('experimental', 'Experimental', true, 160),
  ('blues', 'Blues', true, 170),
  ('reggae', 'Reggae', true, 180),
  ('latin', 'Latin', true, 190),
  ('afrobeats', 'Afrobeats', true, 200),
  ('k-pop', 'K-Pop', true, 210),
  ('funk', 'Funk', true, 220),
  ('house', 'House', true, 230),
  ('techno', 'Techno', true, 240),
  ('shoegaze', 'Shoegaze', true, 250),
  ('singer-songwriter', 'Singer-Songwriter', true, 260),
  ('world', 'World', true, 270),
  ('soundtrack', 'Soundtrack', true, 280)
on conflict (slug) do nothing;
