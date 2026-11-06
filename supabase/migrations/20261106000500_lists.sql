-- =============================================================================
-- MUSICED · 0500 · Lists and collections
-- =============================================================================

create table public.user_lists (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  title        text not null,
  description  text,
  is_ranked    boolean not null default false,
  visibility   public.visibility not null default 'public',
  -- Path in the `list-covers` bucket; NULL means "generate a collage".
  cover_path   text,
  items_count  integer not null default 0 check (items_count >= 0),
  likes_count  integer not null default 0 check (likes_count >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint user_lists_title_length check (char_length(btrim(title)) between 1 and 120),
  constraint user_lists_description_length check (char_length(description) <= 2000),
  constraint user_lists_cover_path_owner check (
    cover_path is null or (char_length(cover_path) <= 200 and cover_path like (user_id::text || '/%'))
  )
);

create index user_lists_user_idx on public.user_lists (user_id, updated_at desc);
create index user_lists_public_popular_idx on public.user_lists (likes_count desc, updated_at desc)
  where visibility = 'public';

create trigger user_lists_set_updated_at
  before update on public.user_lists
  for each row execute function private.set_updated_at();

create table public.list_items (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references public.user_lists (id) on delete cascade,
  album_id    uuid not null references public.albums (id) on delete restrict,
  position    integer not null check (position >= 1),
  note        text check (char_length(note) <= 500),
  created_at  timestamptz not null default now(),
  constraint list_items_album_unique unique (list_id, album_id),
  -- Deferrable so a reorder can shuffle positions inside one transaction.
  constraint list_items_position_unique unique (list_id, position) deferrable initially deferred
);

create index list_items_album_idx on public.list_items (album_id);

create table public.list_likes (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  list_id     uuid not null references public.user_lists (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, list_id)
);

create index list_likes_list_idx on public.list_likes (list_id);

-- -----------------------------------------------------------------------------
-- Counters
-- -----------------------------------------------------------------------------
create or replace function private.handle_list_item_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.user_lists set items_count = items_count + 1, updated_at = now() where id = new.list_id;
    return new;
  else
    update public.user_lists set items_count = greatest(items_count - 1, 0), updated_at = now() where id = old.list_id;
    return old;
  end if;
end;
$$;

create trigger list_items_counter
  after insert or delete on public.list_items
  for each row execute function private.handle_list_item_change();

create or replace function private.handle_list_like_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.user_lists set likes_count = likes_count + 1 where id = new.list_id;
    return new;
  else
    update public.user_lists set likes_count = greatest(likes_count - 1, 0) where id = old.list_id;
    return old;
  end if;
end;
$$;

create trigger list_likes_counter
  after insert or delete on public.list_likes
  for each row execute function private.handle_list_like_change();

-- Lists are capped to keep pages and reorders bounded.
create or replace function private.limit_list_items()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select items_count from public.user_lists where id = new.list_id) >= 500 then
    raise exception 'A list can hold up to 500 albums' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger list_items_limit
  before insert on public.list_items
  for each row execute function private.limit_list_items();

-- Owner check usable from list_items policies.
create or replace function public.viewer_owns_list(target_list uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_lists l
    where l.id = target_list and l.user_id = (select auth.uid())
  );
$$;

revoke execute on function public.viewer_owns_list(uuid) from public;
grant execute on function public.viewer_owns_list(uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------
revoke all on table public.user_lists, public.list_items, public.list_likes from anon, authenticated;

grant select on table public.user_lists to anon, authenticated;
grant insert (user_id, title, description, is_ranked, visibility, cover_path)
  on table public.user_lists to authenticated;
grant update (title, description, is_ranked, visibility, cover_path), delete
  on table public.user_lists to authenticated;

grant select on table public.list_items to anon, authenticated;
grant insert (list_id, album_id, position, note), update (position, note), delete
  on table public.list_items to authenticated;

grant select on table public.list_likes to anon, authenticated;
grant insert (user_id, list_id), delete on table public.list_likes to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.user_lists enable row level security;
alter table public.list_items enable row level security;
alter table public.list_likes enable row level security;

create policy "Lists respect visibility"
  on public.user_lists for select
  to anon, authenticated
  using (public.can_view(user_id, visibility));

create policy "Users create lists as themselves"
  on public.user_lists for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users edit their own lists"
  on public.user_lists for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users delete their own lists"
  on public.user_lists for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- Items are visible exactly when their list is (the subquery is RLS-filtered).
create policy "List items follow list visibility"
  on public.list_items for select
  to anon, authenticated
  using (exists (select 1 from public.user_lists l where l.id = list_id));

create policy "Owners add items to their lists"
  on public.list_items for insert
  to authenticated
  with check (public.viewer_owns_list(list_id));

create policy "Owners edit items in their lists"
  on public.list_items for update
  to authenticated
  using (public.viewer_owns_list(list_id))
  with check (public.viewer_owns_list(list_id));

create policy "Owners remove items from their lists"
  on public.list_items for delete
  to authenticated
  using (public.viewer_owns_list(list_id));

create policy "List likes follow list visibility"
  on public.list_likes for select
  to anon, authenticated
  using (exists (select 1 from public.user_lists l where l.id = list_id));

create policy "Users like visible lists as themselves"
  on public.list_likes for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.user_lists l where l.id = list_id)
  );

create policy "Users unlike lists"
  on public.list_likes for delete
  to authenticated
  using (user_id = (select auth.uid()));
