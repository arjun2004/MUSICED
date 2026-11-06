-- =============================================================================
-- MUSICED · 0400 · Listening domain
-- album_ratings  – one *current* rating per user per album (always public)
-- listening_logs – diary entries; many per user per album; per-entry visibility
-- reviews        – one main review per user per album (initially)
-- favorite_albums
--
-- Album aggregates (album_stats) are maintained here by triggers so clients
-- can never submit aggregate values.
-- =============================================================================

-- Half-star rating, 0.5..5.0.
create domain public.star_rating as numeric(2, 1)
  check (value >= 0.5 and value <= 5.0 and value * 2 = trunc(value * 2));

-- -----------------------------------------------------------------------------
-- album_ratings
-- -----------------------------------------------------------------------------
create table public.album_ratings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  album_id    uuid not null references public.albums (id) on delete restrict,
  rating      public.star_rating not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint album_ratings_user_album_unique unique (user_id, album_id)
);

create index album_ratings_album_idx on public.album_ratings (album_id, created_at desc);
create index album_ratings_user_idx on public.album_ratings (user_id, updated_at desc);

create trigger album_ratings_set_updated_at
  before update on public.album_ratings
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- listening_logs
-- -----------------------------------------------------------------------------
create table public.listening_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  album_id     uuid not null references public.albums (id) on delete restrict,
  listened_on  date not null default current_date,
  rating       public.star_rating,
  note         text,
  is_relisten  boolean not null default false,
  is_favorite  boolean not null default false,
  visibility   public.visibility not null default 'public',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint listening_logs_note_length check (char_length(note) <= 1000),
  constraint listening_logs_date_range check (listened_on >= date '1900-01-01')
);

create index listening_logs_user_date_idx on public.listening_logs (user_id, listened_on desc, created_at desc);
create index listening_logs_album_idx on public.listening_logs (album_id, created_at desc);

create trigger listening_logs_set_updated_at
  before update on public.listening_logs
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- reviews
-- -----------------------------------------------------------------------------
create table public.reviews (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles (id) on delete cascade,
  album_id           uuid not null references public.albums (id) on delete restrict,
  title              text,
  body               text not null,
  rating             public.star_rating,
  contains_spoilers  boolean not null default false,
  visibility         public.visibility not null default 'public',
  likes_count        integer not null default 0 check (likes_count >= 0),
  comments_count     integer not null default 0 check (comments_count >= 0),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  edited_at          timestamptz,
  constraint reviews_user_album_unique unique (user_id, album_id),
  constraint reviews_title_length check (char_length(title) <= 140),
  constraint reviews_body_length check (char_length(btrim(body)) between 1 and 20000)
);

create index reviews_album_idx on public.reviews (album_id, created_at desc);
create index reviews_user_idx on public.reviews (user_id, created_at desc);
create index reviews_public_recent_idx on public.reviews (created_at desc) where visibility = 'public';
create index reviews_public_popular_idx on public.reviews (likes_count desc, created_at desc) where visibility = 'public';

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function private.set_updated_at();

-- Mark substantive edits.
create or replace function private.mark_review_edited()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.body is distinct from old.body or new.title is distinct from old.title then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

create trigger reviews_mark_edited
  before update on public.reviews
  for each row execute function private.mark_review_edited();

-- -----------------------------------------------------------------------------
-- favorite_albums
-- `position` 1..4 pins an album to the profile showcase.
-- -----------------------------------------------------------------------------
create table public.favorite_albums (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  album_id    uuid not null references public.albums (id) on delete restrict,
  position    smallint check (position between 1 and 4),
  created_at  timestamptz not null default now(),
  primary key (user_id, album_id)
);

create unique index favorite_albums_position_unique
  on public.favorite_albums (user_id, position) where position is not null;
create index favorite_albums_album_idx on public.favorite_albums (album_id);

-- -----------------------------------------------------------------------------
-- Aggregate maintenance
-- -----------------------------------------------------------------------------
create or replace function private.ensure_album_stats(target_album uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.album_stats (album_id) values (target_album)
  on conflict (album_id) do nothing;
$$;

create or replace function private.handle_rating_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_idx int;
  new_idx int;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    old_idx := (old.rating * 2)::int;
    perform private.ensure_album_stats(old.album_id);
    update public.album_stats
       set ratings_count = greatest(ratings_count - 1, 0),
           ratings_sum = greatest(ratings_sum - old.rating, 0),
           rating_histogram[old_idx] = greatest(rating_histogram[old_idx] - 1, 0),
           updated_at = now()
     where album_id = old.album_id;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    new_idx := (new.rating * 2)::int;
    perform private.ensure_album_stats(new.album_id);
    update public.album_stats
       set ratings_count = ratings_count + 1,
           ratings_sum = ratings_sum + new.rating,
           rating_histogram[new_idx] = rating_histogram[new_idx] + 1,
           last_activity_at = now(),
           updated_at = now()
     where album_id = new.album_id;
    return new;
  end if;

  return old;
end;
$$;

create trigger album_ratings_stats
  after insert or delete or update of rating, album_id on public.album_ratings
  for each row execute function private.handle_rating_change();

create or replace function private.handle_log_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.ensure_album_stats(new.album_id);
    update public.album_stats
       set logs_count = logs_count + 1, last_activity_at = now(), updated_at = now()
     where album_id = new.album_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.album_stats
       set logs_count = greatest(logs_count - 1, 0), updated_at = now()
     where album_id = old.album_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger listening_logs_stats
  after insert or delete on public.listening_logs
  for each row execute function private.handle_log_change();

-- Only *public* reviews count towards the public review total.
create or replace function private.handle_review_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_public int := 0;
  new_public int := 0;
begin
  if tg_op in ('UPDATE', 'DELETE') and old.visibility = 'public' then old_public := 1; end if;
  if tg_op in ('INSERT', 'UPDATE') and new.visibility = 'public' then new_public := 1; end if;

  if tg_op = 'DELETE' then
    update public.album_stats
       set reviews_count = greatest(reviews_count - old_public, 0), updated_at = now()
     where album_id = old.album_id;
    return old;
  end if;

  if new_public - old_public <> 0 or tg_op = 'INSERT' then
    perform private.ensure_album_stats(new.album_id);
    update public.album_stats
       set reviews_count = greatest(reviews_count + new_public - old_public, 0),
           last_activity_at = case when tg_op = 'INSERT' then now() else last_activity_at end,
           updated_at = now()
     where album_id = new.album_id;
  end if;
  return new;
end;
$$;

create trigger reviews_stats
  after insert or delete or update of visibility on public.reviews
  for each row execute function private.handle_review_stats();

create or replace function private.handle_favorite_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.ensure_album_stats(new.album_id);
    update public.album_stats set favorites_count = favorites_count + 1, updated_at = now()
     where album_id = new.album_id;
    return new;
  else
    update public.album_stats set favorites_count = greatest(favorites_count - 1, 0), updated_at = now()
     where album_id = old.album_id;
    return old;
  end if;
end;
$$;

create trigger favorite_albums_stats
  after insert or delete on public.favorite_albums
  for each row execute function private.handle_favorite_change();

-- -----------------------------------------------------------------------------
-- Privileges
-- Ownership columns (user_id, album_id) are insert-only; counters never writable.
-- -----------------------------------------------------------------------------
revoke all on table public.album_ratings, public.listening_logs, public.reviews, public.favorite_albums
  from anon, authenticated;

grant select on table public.album_ratings to anon, authenticated;
grant insert (user_id, album_id, rating) on table public.album_ratings to authenticated;
grant update (rating), delete on table public.album_ratings to authenticated;

grant select on table public.listening_logs to anon, authenticated;
grant insert (user_id, album_id, listened_on, rating, note, is_relisten, is_favorite, visibility)
  on table public.listening_logs to authenticated;
grant update (listened_on, rating, note, is_relisten, is_favorite, visibility), delete
  on table public.listening_logs to authenticated;

grant select on table public.reviews to anon, authenticated;
grant insert (user_id, album_id, title, body, rating, contains_spoilers, visibility)
  on table public.reviews to authenticated;
grant update (title, body, rating, contains_spoilers, visibility), delete
  on table public.reviews to authenticated;

grant select on table public.favorite_albums to anon, authenticated;
grant insert (user_id, album_id, position), update (position), delete
  on table public.favorite_albums to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.album_ratings enable row level security;
alter table public.listening_logs enable row level security;
alter table public.reviews enable row level security;
alter table public.favorite_albums enable row level security;

-- album_ratings: public, but hidden across a block.
create policy "Ratings are public unless blocked"
  on public.album_ratings for select
  to anon, authenticated
  using (not public.viewer_blocked_with(user_id));

create policy "Users rate as themselves"
  on public.album_ratings for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users change their own ratings"
  on public.album_ratings for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users remove their own ratings"
  on public.album_ratings for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- listening_logs: per-entry visibility.
create policy "Diary entries respect visibility"
  on public.listening_logs for select
  to anon, authenticated
  using (public.can_view(user_id, visibility));

create policy "Users log as themselves"
  on public.listening_logs for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users edit their own diary"
  on public.listening_logs for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users delete their own diary entries"
  on public.listening_logs for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- reviews
create policy "Reviews respect visibility"
  on public.reviews for select
  to anon, authenticated
  using (public.can_view(user_id, visibility));

create policy "Users review as themselves"
  on public.reviews for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users edit their own reviews"
  on public.reviews for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users delete their own reviews"
  on public.reviews for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- favorite_albums
create policy "Favorites are public unless blocked"
  on public.favorite_albums for select
  to anon, authenticated
  using (not public.viewer_blocked_with(user_id));

create policy "Users add their own favorites"
  on public.favorite_albums for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users reorder their own favorites"
  on public.favorite_albums for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users remove their own favorites"
  on public.favorite_albums for delete
  to authenticated
  using (user_id = (select auth.uid()));
