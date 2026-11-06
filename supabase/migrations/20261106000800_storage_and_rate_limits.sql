-- =============================================================================
-- MUSICED · 0800 · Storage buckets and rate limiting
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Storage
-- Public-read buckets (served via public URLs). Writes are restricted to the
-- uploader's own top-level folder: `<auth.uid()>/<file>`.
-- Size and MIME limits are enforced by Storage itself, and again server-side.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('list-covers', 'list-covers', true, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Owners can see their own objects (required for upsert). Public files are
-- served through the public URL endpoint, which does not need a select policy,
-- so buckets cannot be listed by other users.
create policy "Owners can read their own uploads"
  on storage.objects for select
  to authenticated
  using (
    bucket_id in ('avatars', 'list-covers')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Owners upload into their own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('avatars', 'list-covers')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Owners update their own uploads"
  on storage.objects for update
  to authenticated
  using (
    bucket_id in ('avatars', 'list-covers')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id in ('avatars', 'list-covers')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Owners delete their own uploads"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id in ('avatars', 'list-covers')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- -----------------------------------------------------------------------------
-- Rate limiting (fixed window)
-- Used by server actions for sensitive operations (auth, uploads, reports).
-- Only the service role may call it: anonymous callers must not be able to
-- burn other people's buckets.
-- -----------------------------------------------------------------------------
create table public.rate_limits (
  bucket_key    text primary key check (char_length(bucket_key) <= 256),
  window_start  timestamptz not null default now(),
  hits          integer not null default 0
);

alter table public.rate_limits enable row level security;
revoke all on table public.rate_limits from anon, authenticated;
-- No policies: service role only.

create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.rate_limits%rowtype;
begin
  insert into public.rate_limits as rl (bucket_key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (bucket_key) do update
    set hits = case
          when rl.window_start <= now() - make_interval(secs => p_window_seconds) then 1
          else rl.hits + 1
        end,
        window_start = case
          when rl.window_start <= now() - make_interval(secs => p_window_seconds) then now()
          else rl.window_start
        end
  returning * into rec;

  allowed := rec.hits <= p_limit;
  remaining := greatest(p_limit - rec.hits, 0);
  reset_at := rec.window_start + make_interval(secs => p_window_seconds);
  return next;
end;
$$;

revoke execute on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

-- Housekeeping helper (schedule with pg_cron in production).
create or replace function private.purge_expired_cache()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.provider_cache where expires_at < now();
  delete from public.rate_limits where window_start < now() - interval '1 day';
$$;
