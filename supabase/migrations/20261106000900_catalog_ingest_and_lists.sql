-- =============================================================================
-- MUSICED · 0900 · Catalog ingestion, album search, list operations
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Album search
-- Every word in the query must appear in "title + artist credit"; results are
-- ranked by trigram similarity. Runs as the caller (RLS applies).
-- -----------------------------------------------------------------------------
create index albums_search_text_trgm_idx on public.albums
  using gin ((lower(title || ' ' || artist_credit)) extensions.gin_trgm_ops);

create or replace function public.search_albums(p_query text, p_limit integer default 12)
returns table (
  id uuid,
  slug text,
  title text,
  artist_credit text,
  release_year smallint,
  cover_url text,
  album_type public.album_type,
  score real
)
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
             where w <> ''
             limit 8
           ) as patterns
  )
  select a.id, a.slug, a.title, a.artist_credit, a.release_year, a.cover_url, a.album_type,
         extensions.similarity(q.text, lower(a.title || ' ' || a.artist_credit)) as score
  from public.albums a, q
  where char_length(q.text) >= 2
    and cardinality(q.patterns) > 0
    and lower(a.title || ' ' || a.artist_credit) like all (q.patterns)
  order by score desc, a.release_year asc nulls last
  limit least(greatest(p_limit, 1), 50);
$$;

revoke execute on function public.search_albums(text, integer) from public;
grant execute on function public.search_albums(text, integer) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Catalog ingestion
-- Called only by the server-side ingestion layer (service role) with a payload
-- already normalised by src/lib/music-providers. One transaction, serialised
-- per external id, idempotent: re-ingesting returns the existing album.
-- -----------------------------------------------------------------------------
create or replace function private.unique_slug(p_table text, p_base text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate text := p_base;
  n int := 2;
  taken boolean;
begin
  loop
    if p_table = 'albums' then
      select exists (select 1 from public.albums where slug = candidate) into taken;
    else
      select exists (select 1 from public.artists where slug = candidate) into taken;
    end if;
    exit when not taken;
    candidate := p_base || '-' || n;
    n := n + 1;
  end loop;
  return candidate;
end;
$$;

create or replace function public.ingest_album(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider text := p ->> 'provider';
  v_album uuid;
  v_artist uuid;
  v_genre uuid;
  a jsonb;
  g jsonb;
  pos int := 0;
begin
  if v_provider is null or (p ->> 'external_id') is null or (p ->> 'title') is null then
    raise exception 'ingest_album: provider, external_id and title are required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('ingest-album:' || v_provider || ':' || (p ->> 'external_id')));

  select entity_id into v_album
  from public.catalog_sources
  where provider = v_provider and entity_type = 'album' and external_id = p ->> 'external_id';
  if v_album is not null then
    return v_album;
  end if;

  insert into public.albums (
    slug, title, artist_credit, album_type, secondary_types, release_date, release_year,
    label, country, cover_url, cover_status, track_count, duration_ms, synced_at, tracks_synced_at
  )
  values (
    private.unique_slug('albums', coalesce(nullif(p ->> 'slug_base', ''), 'album-' || left(p ->> 'external_id', 8))),
    left(p ->> 'title', 500),
    left(coalesce(nullif(p ->> 'artist_credit', ''), 'Unknown artist'), 500),
    coalesce(nullif(p ->> 'album_type', ''), 'other')::public.album_type,
    coalesce(array(select jsonb_array_elements_text(coalesce(p -> 'secondary_types', '[]'::jsonb))), '{}'),
    nullif(p ->> 'release_date', ''),
    nullif(p ->> 'release_year', '')::smallint,
    nullif(p ->> 'label', ''),
    nullif(p ->> 'country', ''),
    nullif(p ->> 'cover_url', ''),
    coalesce(nullif(p ->> 'cover_status', ''), 'unknown'),
    nullif(jsonb_array_length(coalesce(p -> 'tracks', '[]'::jsonb)), 0),
    (select nullif(sum((x ->> 'duration_ms')::int), 0) from jsonb_array_elements(coalesce(p -> 'tracks', '[]'::jsonb)) as x),
    now(),
    case when p ? 'tracks' then now() end
  )
  returning id into v_album;

  insert into public.catalog_sources (entity_type, entity_id, provider, external_id, url)
  values ('album', v_album, v_provider, p ->> 'external_id', p ->> 'url');

  if nullif(p ->> 'release_external_id', '') is not null then
    insert into public.catalog_sources (entity_type, entity_id, provider, external_id, url)
    values ('release', v_album, v_provider, p ->> 'release_external_id', p ->> 'release_url')
    on conflict do nothing;
  end if;

  for a in select * from jsonb_array_elements(coalesce(p -> 'artists', '[]'::jsonb)) loop
    v_artist := null;
    select entity_id into v_artist
    from public.catalog_sources
    where provider = v_provider and entity_type = 'artist' and external_id = a ->> 'external_id';

    if v_artist is null then
      insert into public.artists (slug, name, sort_name, disambiguation, artist_type, country, synced_at)
      values (
        private.unique_slug('artists', coalesce(nullif(a ->> 'slug_base', ''), 'artist-' || left(a ->> 'external_id', 8))),
        left(a ->> 'name', 500),
        nullif(a ->> 'sort_name', ''),
        nullif(a ->> 'disambiguation', ''),
        nullif(a ->> 'artist_type', ''),
        nullif(a ->> 'country', ''),
        now()
      )
      returning id into v_artist;

      insert into public.catalog_sources (entity_type, entity_id, provider, external_id, url)
      values ('artist', v_artist, v_provider, a ->> 'external_id', a ->> 'url');
    end if;

    insert into public.album_artists (album_id, artist_id, position, credited_name, join_phrase)
    values (v_album, v_artist, pos, nullif(a ->> 'credited_name', ''), coalesce(a ->> 'join_phrase', ''))
    on conflict do nothing;
    pos := pos + 1;
  end loop;

  insert into public.tracks (album_id, disc_number, position, number, title, duration_ms, recording_mbid)
  select v_album, x.disc_number, x.position, x.number, left(x.title, 500), x.duration_ms, x.recording_mbid
  from jsonb_to_recordset(coalesce(p -> 'tracks', '[]'::jsonb))
    as x(disc_number smallint, position smallint, number text, title text, duration_ms integer, recording_mbid uuid)
  where x.title is not null and x.position >= 1
  on conflict do nothing;

  for g in select * from jsonb_array_elements(coalesce(p -> 'genres', '[]'::jsonb)) loop
    insert into public.genres (slug, name) values (g ->> 'slug', left(g ->> 'name', 80))
    on conflict (slug) do nothing;
    select id into v_genre from public.genres where slug = g ->> 'slug';
    insert into public.album_genres (album_id, genre_id, weight)
    values (v_album, v_genre, greatest(coalesce((g ->> 'weight')::int, 1), 0))
    on conflict do nothing;
  end loop;

  perform private.ensure_album_stats(v_album);
  return v_album;
end;
$$;

revoke execute on function public.ingest_album(jsonb) from public, anon, authenticated;
grant execute on function public.ingest_album(jsonb) to service_role;

-- -----------------------------------------------------------------------------
-- List operations (run as the caller: RLS + ownership checks apply)
-- -----------------------------------------------------------------------------

-- Append an album at the end of a list. Returns the new item id.
create or replace function public.append_list_item(p_list_id uuid, p_album_id uuid, p_note text default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.viewer_owns_list(p_list_id) then
    raise exception 'You can only add albums to your own lists' using errcode = '42501';
  end if;

  insert into public.list_items (list_id, album_id, position, note)
  values (
    p_list_id,
    p_album_id,
    coalesce((select max(position) from public.list_items where list_id = p_list_id), 0) + 1,
    nullif(btrim(p_note), '')
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- Rewrite the order of a list. `p_item_ids` must contain every item exactly once.
-- The (list_id, position) unique constraint is deferred to commit, so the
-- shuffle happens atomically.
create or replace function public.reorder_list_items(p_list_id uuid, p_item_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  n int := coalesce(cardinality(p_item_ids), 0);
begin
  if not public.viewer_owns_list(p_list_id) then
    raise exception 'You can only reorder your own lists' using errcode = '42501';
  end if;

  if n <> (select count(*) from public.list_items where list_id = p_list_id)
     or n <> (select count(distinct x) from unnest(p_item_ids) as x)
     or exists (
       select 1 from unnest(p_item_ids) as x(id)
       where not exists (select 1 from public.list_items li where li.id = x.id and li.list_id = p_list_id)
     )
  then
    raise exception 'The new order must include every album in the list exactly once' using errcode = '22023';
  end if;

  update public.list_items li
     set position = o.ord
    from unnest(p_item_ids) with ordinality as o(id, ord)
   where li.id = o.id and li.list_id = p_list_id;

  -- Touch the list (the set_updated_at trigger stamps updated_at).
  update public.user_lists set title = title where id = p_list_id;
end;
$$;

revoke execute on function public.append_list_item(uuid, uuid, text) from public;
revoke execute on function public.reorder_list_items(uuid, uuid[]) from public;
grant execute on function public.append_list_item(uuid, uuid, text) to authenticated;
grant execute on function public.reorder_list_items(uuid, uuid[]) to authenticated;
