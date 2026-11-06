-- =============================================================================
-- MUSICED · 0200 · User domain
-- profiles, user_preferences, user_follows, user_blocks, plus the visibility
-- helpers used by RLS policies throughout the schema.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles
-- One row per auth user, created automatically on signup. `username` may be
-- NULL until onboarding (e.g. OAuth signups); such profiles are not public.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  username         text unique,
  display_name     text,
  bio              text,
  -- Path inside the `avatars` storage bucket. Always prefixed by the user id.
  avatar_path      text,
  location         text,
  website          text,
  role             public.user_role not null default 'user',
  followers_count  integer not null default 0 check (followers_count >= 0),
  following_count  integer not null default 0 check (following_count >= 0),
  onboarded_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint profiles_username_format
    check (username ~ '^[a-z0-9_]{3,24}$'),
  constraint profiles_username_reserved check (username not in (
    'admin', 'administrator', 'musiced', 'support', 'help', 'settings', 'login',
    'signup', 'logout', 'onboarding', 'explore', 'discover', 'diary', 'charts',
    'album', 'albums', 'artist', 'artists', 'list', 'lists', 'user', 'users',
    'api', 'auth', 'root', 'system', 'moderator', 'staff', 'null', 'undefined',
    'me', 'about', 'terms', 'privacy', 'members', 'notifications', 'search'
  )),
  constraint profiles_display_name_length check (char_length(display_name) <= 50),
  constraint profiles_bio_length check (char_length(bio) <= 300),
  constraint profiles_location_length check (char_length(location) <= 60),
  constraint profiles_website_format check (
    website is null or (char_length(website) <= 200 and website ~* '^https?://[^\s]+$')
  ),
  constraint profiles_avatar_path_owner check (
    avatar_path is null
    or (char_length(avatar_path) <= 200 and avatar_path like (id::text || '/%'))
  )
);

comment on table public.profiles is 'Public listener profile. One per auth user.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- user_preferences (private to the owner)
-- -----------------------------------------------------------------------------
create table public.user_preferences (
  user_id                    uuid primary key references public.profiles (id) on delete cascade,
  default_log_visibility     public.visibility not null default 'public',
  default_review_visibility  public.visibility not null default 'public',
  default_list_visibility    public.visibility not null default 'public',
  notify_follows             boolean not null default true,
  notify_likes               boolean not null default true,
  notify_comments            boolean not null default true,
  notify_mentions            boolean not null default true,
  email_notifications        boolean not null default false,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- user_follows
-- -----------------------------------------------------------------------------
create table public.user_follows (
  follower_id   uuid not null references public.profiles (id) on delete cascade,
  following_id  uuid not null references public.profiles (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint user_follows_no_self_follow check (follower_id <> following_id)
);

create index user_follows_following_idx on public.user_follows (following_id, created_at desc);
create index user_follows_follower_created_idx on public.user_follows (follower_id, created_at desc);

-- -----------------------------------------------------------------------------
-- user_blocks
-- -----------------------------------------------------------------------------
create table public.user_blocks (
  blocker_id  uuid not null references public.profiles (id) on delete cascade,
  blocked_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_no_self_block check (blocker_id <> blocked_id)
);

create index user_blocks_blocked_idx on public.user_blocks (blocked_id);

-- -----------------------------------------------------------------------------
-- Viewer-centric visibility helpers
-- These only ever answer questions about the *current* user (auth.uid()), so
-- they cannot be used to probe relationships between arbitrary third parties.
-- SECURITY DEFINER lets them read user_blocks/user_follows regardless of the
-- caller's own RLS view of those tables.
-- -----------------------------------------------------------------------------
create or replace function public.viewer_blocked_with(other_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_blocks b
    where (b.blocker_id = (select auth.uid()) and b.blocked_id = other_user)
       or (b.blocker_id = other_user and b.blocked_id = (select auth.uid()))
  );
$$;

create or replace function public.viewer_follows(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_follows f
    where f.follower_id = (select auth.uid()) and f.following_id = target_user
  );
$$;

-- Can the current viewer see content owned by `owner_id` with `vis`?
create or replace function public.can_view(owner_id uuid, vis public.visibility)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is not null and owner_id = (select auth.uid()) then true
    when public.viewer_blocked_with(owner_id) then false
    when vis = 'public' then true
    when vis = 'followers' then public.viewer_follows(owner_id)
    else false
  end;
$$;

create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('moderator', 'admin')
  );
$$;

revoke execute on function public.viewer_blocked_with(uuid) from public;
revoke execute on function public.viewer_follows(uuid) from public;
revoke execute on function public.can_view(uuid, public.visibility) from public;
revoke execute on function public.is_moderator() from public;
grant execute on function public.viewer_blocked_with(uuid) to anon, authenticated;
grant execute on function public.viewer_follows(uuid) to anon, authenticated;
grant execute on function public.can_view(uuid, public.visibility) to anon, authenticated;
grant execute on function public.is_moderator() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Profile bootstrap on signup
-- Uses the username passed in sign-up metadata if it is valid and free;
-- otherwise leaves it NULL and onboarding asks for one.
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text := lower(nullif(btrim(new.raw_user_meta_data ->> 'username'), ''));
  requested_display  text := left(nullif(btrim(coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name'
  )), ''), 50);
begin
  begin
    insert into public.profiles (id, username, display_name)
    values (new.id, requested_username, requested_display);
  exception when unique_violation or check_violation then
    insert into public.profiles (id, username, display_name)
    values (new.id, null, requested_display);
  end;

  insert into public.user_preferences (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- -----------------------------------------------------------------------------
-- Follow counters + block side effects
-- -----------------------------------------------------------------------------
create or replace function private.handle_follow_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
    update public.profiles set followers_count = followers_count + 1 where id = new.following_id;
    return new;
  else
    update public.profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
    update public.profiles set followers_count = greatest(followers_count - 1, 0) where id = old.following_id;
    return old;
  end if;
end;
$$;

create trigger user_follows_counters
  after insert or delete on public.user_follows
  for each row execute function private.handle_follow_change();

-- Blocking someone removes follow relationships in both directions.
create or replace function private.handle_block_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.user_follows
  where (follower_id = new.blocker_id and following_id = new.blocked_id)
     or (follower_id = new.blocked_id and following_id = new.blocker_id);
  return new;
end;
$$;

create trigger user_blocks_remove_follows
  after insert on public.user_blocks
  for each row execute function private.handle_block_created();

-- -----------------------------------------------------------------------------
-- Privileges (explicit; do not rely on platform defaults)
-- -----------------------------------------------------------------------------
revoke all on table public.profiles, public.user_preferences, public.user_follows, public.user_blocks
  from anon, authenticated;

grant select on table public.profiles to anon, authenticated;
-- Counters, role and id are never client-writable.
grant update (username, display_name, bio, avatar_path, location, website, onboarded_at)
  on table public.profiles to authenticated;

grant select on table public.user_preferences to authenticated;
grant update (
  default_log_visibility, default_review_visibility, default_list_visibility,
  notify_follows, notify_likes, notify_comments, notify_mentions, email_notifications
) on table public.user_preferences to authenticated;

grant select on table public.user_follows to anon, authenticated;
grant insert (follower_id, following_id), delete on table public.user_follows to authenticated;

grant select, delete on table public.user_blocks to authenticated;
grant insert (blocker_id, blocked_id) on table public.user_blocks to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_follows enable row level security;
alter table public.user_blocks enable row level security;

-- profiles
create policy "Onboarded profiles are public"
  on public.profiles for select
  to anon, authenticated
  using (username is not null or id = (select auth.uid()));

create policy "Users update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- user_preferences
create policy "Users read their own preferences"
  on public.user_preferences for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users update their own preferences"
  on public.user_preferences for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- user_follows
create policy "Follow graph is public"
  on public.user_follows for select
  to anon, authenticated
  using (true);

create policy "Users follow others as themselves"
  on public.user_follows for insert
  to authenticated
  with check (
    follower_id = (select auth.uid())
    and not public.viewer_blocked_with(following_id)
  );

create policy "Users unfollow, or remove their own followers"
  on public.user_follows for delete
  to authenticated
  using (follower_id = (select auth.uid()) or following_id = (select auth.uid()));

-- user_blocks (only the blocker ever sees a block)
create policy "Users see blocks they created"
  on public.user_blocks for select
  to authenticated
  using (blocker_id = (select auth.uid()));

create policy "Users block as themselves"
  on public.user_blocks for insert
  to authenticated
  with check (blocker_id = (select auth.uid()));

create policy "Users remove their own blocks"
  on public.user_blocks for delete
  to authenticated
  using (blocker_id = (select auth.uid()));
