-- =============================================================================
-- MUSICED · 1100 · Moderation tooling, suspensions, favourite showcase
-- =============================================================================

alter type public.moderation_action_type add value if not exists 'unsuspend_user';

-- -----------------------------------------------------------------------------
-- Hidden content & suspended accounts (set only via moderate_content)
-- Not client-writable: these columns are not in any client grant.
-- -----------------------------------------------------------------------------
alter table public.reviews add column hidden_at timestamptz;
alter table public.review_comments add column hidden_at timestamptz;
alter table public.user_lists add column hidden_at timestamptz;
alter table public.profiles add column suspended_at timestamptz;

create index reviews_hidden_idx on public.reviews (hidden_at) where hidden_at is not null;
create index review_comments_hidden_idx on public.review_comments (hidden_at) where hidden_at is not null;
create index user_lists_hidden_idx on public.user_lists (hidden_at) where hidden_at is not null;

-- Hidden content stays visible to its author and to moderators only.
drop policy "Reviews respect visibility" on public.reviews;
create policy "Reviews respect visibility and moderation"
  on public.reviews for select to anon, authenticated
  using (
    public.is_moderator()
    or (public.can_view(user_id, visibility) and (hidden_at is null or user_id = (select auth.uid())))
  );

drop policy "Comments follow review visibility" on public.review_comments;
create policy "Comments follow review visibility and moderation"
  on public.review_comments for select to anon, authenticated
  using (
    public.is_moderator()
    or (
      not public.viewer_blocked_with(user_id)
      and (hidden_at is null or user_id = (select auth.uid()))
      and exists (select 1 from public.reviews r where r.id = review_id)
    )
  );

drop policy "Lists respect visibility" on public.user_lists;
create policy "Lists respect visibility and moderation"
  on public.user_lists for select to anon, authenticated
  using (
    public.is_moderator()
    or (public.can_view(user_id, visibility) and (hidden_at is null or user_id = (select auth.uid())))
  );

-- Activities about hidden reviews/lists disappear with them (subqueries are RLS-filtered).
drop policy "Activities respect visibility and blocks" on public.activities;
create policy "Activities respect visibility, blocks and moderation"
  on public.activities for select to anon, authenticated
  using (
    public.can_view(actor_id, visibility)
    and (subject_user_id is null or not public.viewer_blocked_with(subject_user_id))
    and (review_id is null or exists (select 1 from public.reviews r where r.id = review_id))
    and (list_id is null or exists (select 1 from public.user_lists l where l.id = list_id))
  );

-- -----------------------------------------------------------------------------
-- Suspended accounts can read but not write.
-- -----------------------------------------------------------------------------
create or replace function private.block_suspended_writes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.suspended_at is not null
  ) then
    raise exception 'Your account is suspended' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'album_ratings', 'listening_logs', 'reviews', 'review_comments', 'review_likes',
    'comment_likes', 'user_lists', 'list_items', 'list_likes', 'user_follows', 'favorite_albums'
  ] loop
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function private.block_suspended_writes()',
      t || '_block_suspended', t
    );
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- moderate_content: the single, audited entry point for staff actions.
-- -----------------------------------------------------------------------------
create or replace function public.moderate_content(
  p_action text,
  p_target_type public.report_target,
  p_target_id uuid,
  p_reason text,
  p_report_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mod uuid := (select auth.uid());
  v_author uuid;
  v_action_id uuid;
begin
  if not public.is_moderator() then
    raise exception 'Moderators only' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) = 0 then
    raise exception 'A reason is required' using errcode = '22023';
  end if;

  -- Resolve the account behind the target (for suspensions).
  v_author := case p_target_type
    when 'review' then (select user_id from public.reviews where id = p_target_id)
    when 'comment' then (select user_id from public.review_comments where id = p_target_id)
    when 'list' then (select user_id from public.user_lists where id = p_target_id)
    when 'profile' then p_target_id
  end;
  if v_author is null and p_action <> 'dismiss' then
    raise exception 'That content no longer exists' using errcode = '22023';
  end if;
  if v_author = v_mod and p_action in ('suspend_user', 'hide_content', 'delete_content') then
    raise exception 'You cannot moderate your own content' using errcode = '22023';
  end if;

  case p_action
    when 'dismiss', 'warn' then
      null;
    when 'hide_content', 'restore_content' then
      if p_target_type = 'review' then
        update public.reviews set hidden_at = case when p_action = 'hide_content' then now() end where id = p_target_id;
      elsif p_target_type = 'comment' then
        update public.review_comments set hidden_at = case when p_action = 'hide_content' then now() end where id = p_target_id;
      elsif p_target_type = 'list' then
        update public.user_lists set hidden_at = case when p_action = 'hide_content' then now() end where id = p_target_id;
      else
        raise exception 'Profiles cannot be hidden; suspend the account instead' using errcode = '22023';
      end if;
    when 'delete_content' then
      if p_target_type = 'review' then delete from public.reviews where id = p_target_id;
      elsif p_target_type = 'comment' then delete from public.review_comments where id = p_target_id;
      elsif p_target_type = 'list' then delete from public.user_lists where id = p_target_id;
      else raise exception 'Profiles cannot be deleted from moderation' using errcode = '22023';
      end if;
    when 'suspend_user' then
      if (select role from public.profiles where id = v_author) in ('moderator', 'admin') then
        raise exception 'Staff accounts cannot be suspended here' using errcode = '22023';
      end if;
      update public.profiles set suspended_at = now() where id = v_author;
    when 'unsuspend_user' then
      update public.profiles set suspended_at = null where id = v_author;
    else
      raise exception 'Unknown action %', p_action using errcode = '22023';
  end case;

  insert into public.moderation_actions (moderator_id, report_id, action, target_type, target_id, reason, metadata)
  values (v_mod, p_report_id, p_action::public.moderation_action_type, p_target_type, p_target_id, btrim(p_reason),
          jsonb_build_object('author_id', v_author))
  returning id into v_action_id;

  -- Close every open report about this target.
  update public.reports
     set status = case when p_action = 'dismiss' then 'dismissed'::public.report_status else 'resolved'::public.report_status end,
         resolved_by = v_mod,
         resolved_at = now()
   where target_type = p_target_type and target_id = p_target_id and status in ('open', 'reviewing');

  return v_action_id;
end;
$$;

revoke execute on function public.moderate_content(text, public.report_target, uuid, text, uuid) from public, anon;
grant execute on function public.moderate_content(text, public.report_target, uuid, text, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Profile showcase: set the ordered top-4 favourites in one call.
-- -----------------------------------------------------------------------------
create or replace function public.set_favorite_showcase(p_album_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  i int;
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if coalesce(cardinality(p_album_ids), 0) > 4 then
    raise exception 'Pick up to four albums' using errcode = '22023';
  end if;
  if (select count(distinct x) from unnest(p_album_ids) x) <> coalesce(cardinality(p_album_ids), 0) then
    raise exception 'Each album can only appear once' using errcode = '22023';
  end if;

  update public.favorite_albums set position = null where user_id = v_uid and position is not null;
  for i in 1 .. coalesce(cardinality(p_album_ids), 0) loop
    insert into public.favorite_albums (user_id, album_id, position)
    values (v_uid, p_album_ids[i], i)
    on conflict (user_id, album_id) do update set position = excluded.position;
  end loop;
end;
$$;

revoke execute on function public.set_favorite_showcase(uuid[]) from public;
grant execute on function public.set_favorite_showcase(uuid[]) to authenticated;
