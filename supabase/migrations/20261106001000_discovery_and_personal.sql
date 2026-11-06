-- =============================================================================
-- MUSICED · 1000 · Favourite artists, artist ingestion, charts & explore,
--                  listening helpers
-- =============================================================================

-- -----------------------------------------------------------------------------
-- user_favorite_artists (taste profile; chosen in onboarding / settings)
-- -----------------------------------------------------------------------------
create table public.user_favorite_artists (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  artist_id   uuid not null references public.artists (id) on delete cascade,
  position    smallint not null default 0,
  created_at  timestamptz not null default now(),
  primary key (user_id, artist_id)
);

create index user_favorite_artists_artist_idx on public.user_favorite_artists (artist_id);

create or replace function private.limit_favorite_artists()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.user_favorite_artists where user_id = new.user_id) >= 12 then
    raise exception 'You can pick up to 12 favorite artists' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger user_favorite_artists_limit
  before insert on public.user_favorite_artists
  for each row execute function private.limit_favorite_artists();

revoke all on table public.user_favorite_artists from anon, authenticated;
grant select on table public.user_favorite_artists to anon, authenticated;
grant insert (user_id, artist_id, position), delete on table public.user_favorite_artists to authenticated;
alter table public.user_favorite_artists enable row level security;

create policy "Favorite artists are public unless blocked"
  on public.user_favorite_artists for select to anon, authenticated
  using (not public.viewer_blocked_with(user_id));
create policy "Users add their own favorite artists"
  on public.user_favorite_artists for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Users remove their own favorite artists"
  on public.user_favorite_artists for delete to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- ingest_artist: idempotent artist import (service role only)
-- -----------------------------------------------------------------------------
create or replace function public.ingest_artist(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider text := p ->> 'provider';
  v_artist uuid;
begin
  if v_provider is null or (p ->> 'external_id') is null or (p ->> 'name') is null then
    raise exception 'ingest_artist: provider, external_id and name are required' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('ingest-artist:' || v_provider || ':' || (p ->> 'external_id')));

  select entity_id into v_artist from public.catalog_sources
  where provider = v_provider and entity_type = 'artist' and external_id = p ->> 'external_id';

  if v_artist is null then
    insert into public.artists (slug, name, sort_name, disambiguation, artist_type, country, begin_date, end_date, synced_at)
    values (
      private.unique_slug('artists', coalesce(nullif(p ->> 'slug_base', ''), 'artist-' || left(p ->> 'external_id', 8))),
      left(p ->> 'name', 500), nullif(p ->> 'sort_name', ''), nullif(p ->> 'disambiguation', ''),
      nullif(p ->> 'artist_type', ''), nullif(p ->> 'country', ''),
      nullif(p ->> 'begin_date', ''), nullif(p ->> 'end_date', ''), now()
    )
    returning id into v_artist;
    insert into public.catalog_sources (entity_type, entity_id, provider, external_id, url)
    values ('artist', v_artist, v_provider, p ->> 'external_id', p ->> 'url');
  else
    -- Fill in details that album credits don't carry (type, country, dates).
    update public.artists set
      sort_name = coalesce(sort_name, nullif(p ->> 'sort_name', '')),
      disambiguation = coalesce(disambiguation, nullif(p ->> 'disambiguation', '')),
      artist_type = coalesce(artist_type, nullif(p ->> 'artist_type', '')),
      country = coalesce(country, nullif(p ->> 'country', '')),
      begin_date = coalesce(begin_date, nullif(p ->> 'begin_date', '')),
      end_date = coalesce(end_date, nullif(p ->> 'end_date', '')),
      synced_at = now()
    where id = v_artist;
  end if;
  return v_artist;
end;
$$;

revoke execute on function public.ingest_artist(jsonb) from public, anon, authenticated;
grant execute on function public.ingest_artist(jsonb) to service_role;

-- -----------------------------------------------------------------------------
-- Artist search (same rules as search_albums)
-- -----------------------------------------------------------------------------
create or replace function public.search_artists(p_query text, p_limit integer default 8)
returns table (id uuid, slug text, name text, disambiguation text, country text, artist_type text)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select lower(btrim(p_query)) as text,
           array(
             select '%' || replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_') || '%'
             from unnest(string_to_array(lower(btrim(p_query)), ' ')) as w
             where w <> '' limit 6
           ) as patterns
  )
  select a.id, a.slug, a.name, a.disambiguation, a.country, a.artist_type
  from public.artists a, q
  where char_length(q.text) >= 2 and cardinality(q.patterns) > 0
    and lower(a.name) like all (q.patterns)
  order by extensions.similarity(q.text, lower(a.name)) desc, a.name
  limit least(greatest(p_limit, 1), 30);
$$;

revoke execute on function public.search_artists(text, integer) from public;
grant execute on function public.search_artists(text, integer) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- browse_albums: Explore + Charts in one ranked, filterable query.
--   sort = 'top'      Bayesian average (weights small samples toward the mean)
--          'popular'  most ratings + logs
--          'trending' most public activity in the last 7 days
--          'new'      newest release date
--          'recent'   most recently added to MUSICED
-- Runs as the caller; only public catalog + public activity is involved.
-- -----------------------------------------------------------------------------
create or replace function public.browse_albums(
  p_sort text default 'top',
  p_genre text default null,
  p_decade integer default null,
  p_year integer default null,
  p_country text default null,
  p_min_ratings integer default 1,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id uuid, slug text, title text, artist_credit text, release_year smallint, cover_url text,
  album_type public.album_type, average_rating numeric, ratings_count integer, score double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  with prior as (
    select coalesce(sum(ratings_sum) / nullif(sum(ratings_count), 0), 3.0)::double precision as mean
    from public.album_stats
  ),
  recent as (
    select a.album_id, count(*)::double precision as hits
    from public.activities a
    where p_sort = 'trending'
      and a.visibility = 'public'
      and a.album_id is not null
      and a.type in ('rated', 'logged', 'reviewed')
      and a.created_at > now() - interval '7 days'
    group by a.album_id
  )
  select al.id, al.slug, al.title, al.artist_credit, al.release_year, al.cover_url, al.album_type,
         s.average_rating, coalesce(s.ratings_count, 0) as ratings_count,
         case p_sort
           when 'top' then
             (coalesce(s.ratings_count, 0) * coalesce(s.average_rating::double precision, 0) + 5 * prior.mean)
             / (coalesce(s.ratings_count, 0) + 5)
           when 'popular' then (coalesce(s.ratings_count, 0) + coalesce(s.logs_count, 0))::double precision
           when 'trending' then coalesce(r.hits, 0)
           when 'new' then extract(epoch from coalesce(
             to_date(case
               when al.release_date ~ '^\d{4}-\d{2}-\d{2}$' then al.release_date
               when al.release_date ~ '^\d{4}-\d{2}$' then al.release_date || '-01'
               when al.release_date ~ '^\d{4}$' then al.release_date || '-01-01'
             end, 'YYYY-MM-DD'), date '1000-01-01'))::double precision
           else extract(epoch from al.created_at)::double precision
         end as score
  from public.albums al
  cross join prior
  left join public.album_stats s on s.album_id = al.id
  left join recent r on r.album_id = al.id
  where (p_genre is null or exists (
          select 1 from public.album_genres ag join public.genres g on g.id = ag.genre_id
          where ag.album_id = al.id and g.slug = p_genre))
    and (p_decade is null or (al.release_year >= p_decade and al.release_year < p_decade + 10))
    and (p_year is null or al.release_year = p_year)
    and (p_country is null or al.country = upper(p_country))
    and (p_sort <> 'top' or coalesce(s.ratings_count, 0) >= greatest(p_min_ratings, 1))
    and (p_sort <> 'popular' or coalesce(s.ratings_count, 0) + coalesce(s.logs_count, 0) > 0)
    and (p_sort <> 'trending' or r.hits is not null)
  order by score desc nulls last, al.title
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

revoke execute on function public.browse_albums(text, text, integer, integer, text, integer, integer, integer) from public;
grant execute on function public.browse_albums(text, text, integer, integer, text, integer, integer, integer) to anon, authenticated;

-- Facets for the Explore page.
create or replace function public.explore_facets()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'genres', coalesce((
      select jsonb_agg(row_to_json(x) order by x.albums desc, x.name)
      from (
        select g.slug, g.name, count(*)::int as albums
        from public.album_genres ag join public.genres g on g.id = ag.genre_id
        group by g.slug, g.name
        having count(*) > 0
        order by count(*) desc, g.name
        limit 60
      ) x), '[]'::jsonb),
    'decades', coalesce((
      select jsonb_agg(row_to_json(x) order by x.decade desc)
      from (
        select (release_year / 10 * 10)::int as decade, count(*)::int as albums
        from public.albums where release_year is not null
        group by 1
      ) x), '[]'::jsonb),
    'countries', coalesce((
      select jsonb_agg(row_to_json(x) order by x.albums desc)
      from (
        select country, count(*)::int as albums
        from public.albums where country is not null
        group by country
        order by count(*) desc
        limit 40
      ) x), '[]'::jsonb),
    'total', (select count(*) from public.albums)
  );
$$;

revoke execute on function public.explore_facets() from public;
grant execute on function public.explore_facets() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Favourites: toggle with automatic profile showcase slot (1..4) when free.
-- -----------------------------------------------------------------------------
create or replace function public.add_favorite_album(p_album_id uuid)
returns smallint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_slot smallint;
begin
  if v_uid is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  select s into v_slot
  from generate_series(1, 4) as s
  where not exists (select 1 from public.favorite_albums f where f.user_id = v_uid and f.position = s)
  order by s
  limit 1;

  insert into public.favorite_albums (user_id, album_id, position)
  values (v_uid, p_album_id, v_slot)
  on conflict (user_id, album_id) do nothing;
  return v_slot;
end;
$$;

revoke execute on function public.add_favorite_album(uuid) from public;
grant execute on function public.add_favorite_album(uuid) to authenticated;

-- Notifications: mark everything read in one call.
create or replace function public.mark_all_notifications_read()
returns integer
language sql
security invoker
set search_path = ''
as $$
  with updated as (
    update public.notifications set read_at = now()
    where recipient_id = (select auth.uid()) and read_at is null
    returning 1
  )
  select count(*)::int from updated;
$$;

revoke execute on function public.mark_all_notifications_read() from public;
grant execute on function public.mark_all_notifications_read() to authenticated;
