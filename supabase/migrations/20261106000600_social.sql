-- =============================================================================
-- MUSICED · 0600 · Social domain
-- activities, review_likes, review_comments, comment_likes, notifications.
--
-- Activities and notifications are produced ONLY by triggers (SECURITY
-- DEFINER) so they cannot be forged by clients. Each activity carries the
-- visibility of its source row and is kept in sync when that changes, so a
-- private diary entry can never surface through a feed.
-- =============================================================================

create type public.activity_type as enum (
  'rated', 'logged', 'reviewed', 'created_list', 'liked_review', 'liked_list', 'followed'
);

create type public.notification_type as enum (
  'followed', 'liked_review', 'commented_review', 'replied_comment',
  'liked_comment', 'liked_list', 'mentioned'
);

-- -----------------------------------------------------------------------------
-- review_likes
-- -----------------------------------------------------------------------------
create table public.review_likes (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  review_id   uuid not null references public.reviews (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, review_id)
);

create index review_likes_review_idx on public.review_likes (review_id, created_at desc);

-- -----------------------------------------------------------------------------
-- review_comments (one level of replies via parent_id)
-- -----------------------------------------------------------------------------
create table public.review_comments (
  id           uuid primary key default gen_random_uuid(),
  review_id    uuid not null references public.reviews (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  parent_id    uuid references public.review_comments (id) on delete cascade,
  body         text not null,
  likes_count  integer not null default 0 check (likes_count >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  edited_at    timestamptz,
  constraint review_comments_body_length check (char_length(btrim(body)) between 1 and 2000)
);

create index review_comments_review_idx on public.review_comments (review_id, created_at);
create index review_comments_user_idx on public.review_comments (user_id, created_at desc);
create index review_comments_parent_idx on public.review_comments (parent_id);

create trigger review_comments_set_updated_at
  before update on public.review_comments
  for each row execute function private.set_updated_at();

create table public.comment_likes (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  comment_id  uuid not null references public.review_comments (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, comment_id)
);

create index comment_likes_comment_idx on public.comment_likes (comment_id);

-- -----------------------------------------------------------------------------
-- activities
-- -----------------------------------------------------------------------------
create table public.activities (
  id               uuid primary key default gen_random_uuid(),
  actor_id         uuid not null references public.profiles (id) on delete cascade,
  type             public.activity_type not null,
  visibility       public.visibility not null default 'public',
  album_id         uuid references public.albums (id) on delete cascade,
  rating_id        uuid references public.album_ratings (id) on delete cascade,
  log_id           uuid references public.listening_logs (id) on delete cascade,
  review_id        uuid references public.reviews (id) on delete cascade,
  list_id          uuid references public.user_lists (id) on delete cascade,
  subject_user_id  uuid references public.profiles (id) on delete cascade,
  rating           public.star_rating,
  created_at       timestamptz not null default now()
);

create index activities_actor_idx on public.activities (actor_id, created_at desc);
create index activities_public_recent_idx on public.activities (created_at desc) where visibility = 'public';
create index activities_rating_idx on public.activities (rating_id) where rating_id is not null;
create index activities_log_idx on public.activities (log_id) where log_id is not null;
create index activities_review_idx on public.activities (review_id) where review_id is not null;
create index activities_list_idx on public.activities (list_id) where list_id is not null;
create index activities_album_idx on public.activities (album_id, created_at desc) where album_id is not null;

-- -----------------------------------------------------------------------------
-- notifications
-- -----------------------------------------------------------------------------
create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references public.profiles (id) on delete cascade,
  actor_id      uuid not null references public.profiles (id) on delete cascade,
  type          public.notification_type not null,
  review_id     uuid references public.reviews (id) on delete cascade,
  comment_id    uuid references public.review_comments (id) on delete cascade,
  list_id       uuid references public.user_lists (id) on delete cascade,
  read_at       timestamptz,
  created_at    timestamptz not null default now(),
  constraint notifications_not_self check (recipient_id <> actor_id)
);

create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_id) where read_at is null;

-- -----------------------------------------------------------------------------
-- Notification helper: respects preferences, blocks, and never self-notifies.
-- -----------------------------------------------------------------------------
create or replace function private.notify(
  p_recipient uuid,
  p_actor uuid,
  p_type public.notification_type,
  p_review uuid default null,
  p_comment uuid default null,
  p_list uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  prefs public.user_preferences%rowtype;
begin
  if p_recipient is null or p_recipient = p_actor then
    return;
  end if;

  if exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = p_recipient and b.blocked_id = p_actor)
       or (b.blocker_id = p_actor and b.blocked_id = p_recipient)
  ) then
    return;
  end if;

  select * into prefs from public.user_preferences where user_id = p_recipient;
  if found then
    if p_type = 'followed' and not prefs.notify_follows then return; end if;
    if p_type in ('liked_review', 'liked_comment', 'liked_list') and not prefs.notify_likes then return; end if;
    if p_type in ('commented_review', 'replied_comment') and not prefs.notify_comments then return; end if;
    if p_type = 'mentioned' and not prefs.notify_mentions then return; end if;
  end if;

  insert into public.notifications (recipient_id, actor_id, type, review_id, comment_id, list_id)
  values (p_recipient, p_actor, p_type, p_review, p_comment, p_list);
end;
$$;

-- Notify up to 10 distinct @mentioned users found in `body`.
create or replace function private.notify_mentions(
  p_body text,
  p_actor uuid,
  p_review uuid,
  p_comment uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  mentioned uuid;
begin
  for mentioned in
    select p.id
    from (
      select distinct m[1] as username
      from regexp_matches(lower(p_body), '(?:^|[^a-z0-9_])@([a-z0-9_]{3,24})', 'g') as m
      limit 10
    ) as found
    join public.profiles p on p.username = found.username
  loop
    perform private.notify(mentioned, p_actor, 'mentioned', p_review, p_comment, null);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Activity producers
-- -----------------------------------------------------------------------------
create or replace function private.activity_from_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activities (actor_id, type, visibility, album_id, rating_id, rating)
    values (new.user_id, 'rated', 'public', new.album_id, new.id, new.rating);
  elsif new.rating is distinct from old.rating then
    update public.activities
       set rating = new.rating, created_at = now()
     where rating_id = new.id;
  end if;
  return new;
end;
$$;

create trigger album_ratings_activity
  after insert or update of rating on public.album_ratings
  for each row execute function private.activity_from_rating();

create or replace function private.activity_from_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activities (actor_id, type, visibility, album_id, log_id, rating)
    values (new.user_id, 'logged', new.visibility, new.album_id, new.id, new.rating);
  else
    update public.activities
       set visibility = new.visibility, rating = new.rating
     where log_id = new.id;
  end if;
  return new;
end;
$$;

create trigger listening_logs_activity
  after insert or update of visibility, rating on public.listening_logs
  for each row execute function private.activity_from_log();

create or replace function private.activity_from_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activities (actor_id, type, visibility, album_id, review_id, rating)
    values (new.user_id, 'reviewed', new.visibility, new.album_id, new.id, new.rating);
    -- Only public reviews notify mentioned users (they must be able to read it).
    if new.visibility = 'public' then
      perform private.notify_mentions(new.body, new.user_id, new.id, null);
    end if;
  else
    update public.activities
       set visibility = new.visibility, rating = new.rating
     where review_id = new.id and type = 'reviewed';
    -- "X liked a review" activities are owned by the liker, so their audience
    -- check is against the liker. They may therefore only exist for public
    -- reviews; drop them once the review stops being public.
    if new.visibility <> 'public' then
      delete from public.activities where review_id = new.id and type = 'liked_review';
    end if;
  end if;
  return new;
end;
$$;

create trigger reviews_activity
  after insert or update of visibility, rating on public.reviews
  for each row execute function private.activity_from_review();

create or replace function private.activity_from_list()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activities (actor_id, type, visibility, list_id)
    values (new.user_id, 'created_list', new.visibility, new.id);
  else
    update public.activities set visibility = new.visibility
     where list_id = new.id and type = 'created_list';
    -- See activity_from_review: like activities are public-only.
    if new.visibility <> 'public' then
      delete from public.activities where list_id = new.id and type = 'liked_list';
    end if;
  end if;
  return new;
end;
$$;

create trigger user_lists_activity
  after insert or update of visibility on public.user_lists
  for each row execute function private.activity_from_list();

create or replace function private.activity_from_follow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activities (actor_id, type, visibility, subject_user_id)
    values (new.follower_id, 'followed', 'public', new.following_id);
    perform private.notify(new.following_id, new.follower_id, 'followed');
    return new;
  else
    delete from public.activities
     where type = 'followed' and actor_id = old.follower_id and subject_user_id = old.following_id;
    delete from public.notifications
     where type = 'followed' and actor_id = old.follower_id and recipient_id = old.following_id;
    return old;
  end if;
end;
$$;

create trigger user_follows_activity
  after insert or delete on public.user_follows
  for each row execute function private.activity_from_follow();

-- -----------------------------------------------------------------------------
-- Likes & comments: counters, activities, notifications
-- -----------------------------------------------------------------------------
create or replace function private.handle_review_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.reviews%rowtype;
begin
  if tg_op = 'INSERT' then
    select * into r from public.reviews where id = new.review_id;
    update public.reviews set likes_count = likes_count + 1 where id = new.review_id;
    if r.visibility = 'public' then
      insert into public.activities (actor_id, type, visibility, album_id, review_id, subject_user_id)
      values (new.user_id, 'liked_review', 'public', r.album_id, r.id, r.user_id);
    end if;
    perform private.notify(r.user_id, new.user_id, 'liked_review', r.id);
    return new;
  else
    update public.reviews set likes_count = greatest(likes_count - 1, 0) where id = old.review_id;
    delete from public.activities
     where type = 'liked_review' and actor_id = old.user_id and review_id = old.review_id;
    delete from public.notifications
     where type = 'liked_review' and actor_id = old.user_id and review_id = old.review_id;
    return old;
  end if;
end;
$$;

create trigger review_likes_effects
  after insert or delete on public.review_likes
  for each row execute function private.handle_review_like();

create or replace function private.handle_review_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  review_author uuid;
  review_visibility public.visibility;
  parent_author uuid;
begin
  if tg_op = 'INSERT' then
    update public.reviews set comments_count = comments_count + 1 where id = new.review_id
    returning user_id, visibility into review_author, review_visibility;

    if new.parent_id is not null then
      select user_id into parent_author from public.review_comments where id = new.parent_id;
      perform private.notify(parent_author, new.user_id, 'replied_comment', new.review_id, new.id);
    end if;

    if parent_author is distinct from review_author then
      perform private.notify(review_author, new.user_id, 'commented_review', new.review_id, new.id);
    end if;

    if review_visibility = 'public' then
      perform private.notify_mentions(new.body, new.user_id, new.review_id, new.id);
    end if;
    return new;
  else
    update public.reviews set comments_count = greatest(comments_count - 1, 0) where id = old.review_id;
    return old;
  end if;
end;
$$;

create trigger review_comments_effects
  after insert or delete on public.review_comments
  for each row execute function private.handle_review_comment();

-- Replies must belong to the same review and may only nest one level.
create or replace function private.validate_comment_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent public.review_comments%rowtype;
begin
  if new.parent_id is null then
    return new;
  end if;
  select * into parent from public.review_comments where id = new.parent_id;
  if not found or parent.review_id <> new.review_id then
    raise exception 'Reply must belong to the same review' using errcode = 'check_violation';
  end if;
  if parent.parent_id is not null then
    raise exception 'Replies can only be one level deep' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger review_comments_validate_parent
  before insert on public.review_comments
  for each row execute function private.validate_comment_parent();

create or replace function private.mark_comment_edited()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

create trigger review_comments_mark_edited
  before update on public.review_comments
  for each row execute function private.mark_comment_edited();

create or replace function private.handle_comment_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.review_comments%rowtype;
begin
  if tg_op = 'INSERT' then
    update public.review_comments set likes_count = likes_count + 1 where id = new.comment_id
    returning * into c;
    perform private.notify(c.user_id, new.user_id, 'liked_comment', c.review_id, c.id);
    return new;
  else
    update public.review_comments set likes_count = greatest(likes_count - 1, 0) where id = old.comment_id;
    delete from public.notifications
     where type = 'liked_comment' and actor_id = old.user_id and comment_id = old.comment_id;
    return old;
  end if;
end;
$$;

create trigger comment_likes_effects
  after insert or delete on public.comment_likes
  for each row execute function private.handle_comment_like();

create or replace function private.handle_list_like_social()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.user_lists%rowtype;
begin
  if tg_op = 'INSERT' then
    select * into l from public.user_lists where id = new.list_id;
    if l.visibility = 'public' then
      insert into public.activities (actor_id, type, visibility, list_id, subject_user_id)
      values (new.user_id, 'liked_list', 'public', l.id, l.user_id);
    end if;
    perform private.notify(l.user_id, new.user_id, 'liked_list', null, null, l.id);
    return new;
  else
    delete from public.activities
     where type = 'liked_list' and actor_id = old.user_id and list_id = old.list_id;
    delete from public.notifications
     where type = 'liked_list' and actor_id = old.user_id and list_id = old.list_id;
    return old;
  end if;
end;
$$;

create trigger list_likes_social
  after insert or delete on public.list_likes
  for each row execute function private.handle_list_like_social();

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------
revoke all on table
  public.review_likes, public.review_comments, public.comment_likes,
  public.activities, public.notifications
from anon, authenticated;

grant select on table public.review_likes to anon, authenticated;
grant insert (user_id, review_id), delete on table public.review_likes to authenticated;

grant select on table public.review_comments to anon, authenticated;
grant insert (review_id, user_id, parent_id, body) on table public.review_comments to authenticated;
grant update (body), delete on table public.review_comments to authenticated;

grant select on table public.comment_likes to anon, authenticated;
grant insert (user_id, comment_id), delete on table public.comment_likes to authenticated;

grant select on table public.activities to anon, authenticated;

grant select, delete on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- Subqueries against public.reviews are themselves RLS-filtered, so "the
-- review exists" means "the viewer is allowed to see the review".
-- -----------------------------------------------------------------------------
alter table public.review_likes enable row level security;
alter table public.review_comments enable row level security;
alter table public.comment_likes enable row level security;
alter table public.activities enable row level security;
alter table public.notifications enable row level security;

-- review_likes
create policy "Review likes follow review visibility"
  on public.review_likes for select
  to anon, authenticated
  using (exists (select 1 from public.reviews r where r.id = review_id));

create policy "Users like visible reviews as themselves"
  on public.review_likes for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.reviews r where r.id = review_id)
  );

create policy "Users remove their own review likes"
  on public.review_likes for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- review_comments
create policy "Comments follow review visibility"
  on public.review_comments for select
  to anon, authenticated
  using (
    not public.viewer_blocked_with(user_id)
    and exists (select 1 from public.reviews r where r.id = review_id)
  );

create policy "Users comment on visible reviews as themselves"
  on public.review_comments for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.reviews r
      where r.id = review_id and not public.viewer_blocked_with(r.user_id)
    )
  );

create policy "Users edit their own comments"
  on public.review_comments for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Authors or review owners delete comments"
  on public.review_comments for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.reviews r
      where r.id = review_id and r.user_id = (select auth.uid())
    )
  );

-- comment_likes
create policy "Comment likes follow comment visibility"
  on public.comment_likes for select
  to anon, authenticated
  using (exists (select 1 from public.review_comments c where c.id = comment_id));

create policy "Users like visible comments as themselves"
  on public.comment_likes for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.review_comments c where c.id = comment_id)
  );

create policy "Users remove their own comment likes"
  on public.comment_likes for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- activities: visible per source visibility and never across a block.
create policy "Activities respect visibility and blocks"
  on public.activities for select
  to anon, authenticated
  using (
    public.can_view(actor_id, visibility)
    and (subject_user_id is null or not public.viewer_blocked_with(subject_user_id))
  );

-- notifications: private to the recipient.
create policy "Users read their own notifications"
  on public.notifications for select
  to authenticated
  using (recipient_id = (select auth.uid()));

create policy "Users mark their own notifications read"
  on public.notifications for update
  to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

create policy "Users dismiss their own notifications"
  on public.notifications for delete
  to authenticated
  using (recipient_id = (select auth.uid()));

-- Realtime: let recipients subscribe to new notifications.
alter publication supabase_realtime add table public.notifications;
