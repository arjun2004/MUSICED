-- =============================================================================
-- MUSICED · 0700 · Moderation and subscriptions
-- =============================================================================

create type public.report_target as enum ('review', 'comment', 'list', 'profile');
create type public.report_reason as enum (
  'spam', 'harassment', 'hate', 'sexual_content', 'violence', 'impersonation',
  'misinformation', 'copyright', 'other'
);
create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');
create type public.moderation_action_type as enum (
  'dismiss', 'warn', 'hide_content', 'delete_content', 'suspend_user', 'restore_content'
);

-- -----------------------------------------------------------------------------
-- reports
-- -----------------------------------------------------------------------------
create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references public.profiles (id) on delete cascade,
  target_type  public.report_target not null,
  target_id    uuid not null,
  reason       public.report_reason not null,
  details      text check (char_length(details) <= 2000),
  status       public.report_status not null default 'open',
  resolved_by  uuid references public.profiles (id) on delete set null,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- One open report per reporter per target.
  constraint reports_reporter_target_unique unique (reporter_id, target_type, target_id)
);

create index reports_status_idx on public.reports (status, created_at);
create index reports_target_idx on public.reports (target_type, target_id);

create trigger reports_set_updated_at
  before update on public.reports
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- moderation_actions — append-only audit log
-- -----------------------------------------------------------------------------
create table public.moderation_actions (
  id            uuid primary key default gen_random_uuid(),
  moderator_id  uuid not null references public.profiles (id) on delete restrict,
  report_id     uuid references public.reports (id) on delete set null,
  action        public.moderation_action_type not null,
  target_type   public.report_target not null,
  target_id     uuid not null,
  reason        text not null check (char_length(btrim(reason)) between 1 and 2000),
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index moderation_actions_target_idx on public.moderation_actions (target_type, target_id, created_at desc);
create index moderation_actions_moderator_idx on public.moderation_actions (moderator_id, created_at desc);

-- -----------------------------------------------------------------------------
-- subscription_plans / user_subscriptions
-- Billing integrations (Stripe, Razorpay) write user_subscriptions from
-- verified webhooks using the service role. Clients only read.
-- -----------------------------------------------------------------------------
create table public.subscription_plans (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique check (code ~ '^[a-z0-9_]{2,40}$'),
  name               text not null,
  description        text,
  price_cents        integer not null check (price_cents >= 0),
  currency           text not null check (currency ~ '^[A-Z]{3}$'),
  billing_interval   text not null check (billing_interval in ('month', 'year')),
  features           jsonb not null default '[]'::jsonb,
  stripe_price_id    text unique,
  razorpay_plan_id   text unique,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger subscription_plans_set_updated_at
  before update on public.subscription_plans
  for each row execute function private.set_updated_at();

create table public.user_subscriptions (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references public.profiles (id) on delete cascade,
  plan_id                   uuid not null references public.subscription_plans (id) on delete restrict,
  status                    text not null check (status in ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'expired')),
  provider                  text not null check (provider in ('stripe', 'razorpay', 'manual')),
  provider_subscription_id  text,
  current_period_start      timestamptz,
  current_period_end        timestamptz,
  cancel_at_period_end      boolean not null default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint user_subscriptions_provider_unique unique (provider, provider_subscription_id)
);

create index user_subscriptions_user_idx on public.user_subscriptions (user_id, status);

create trigger user_subscriptions_set_updated_at
  before update on public.user_subscriptions
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------
revoke all on table public.reports, public.moderation_actions, public.subscription_plans, public.user_subscriptions
  from anon, authenticated;

grant select on table public.reports to authenticated;
grant insert (reporter_id, target_type, target_id, reason, details) on table public.reports to authenticated;
grant update (status, resolved_by, resolved_at) on table public.reports to authenticated;

grant select on table public.moderation_actions to authenticated;
grant insert (moderator_id, report_id, action, target_type, target_id, reason, metadata)
  on table public.moderation_actions to authenticated;

grant select on table public.subscription_plans to anon, authenticated;
grant select on table public.user_subscriptions to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.user_subscriptions enable row level security;

create policy "Reporters see their own reports; moderators see all"
  on public.reports for select
  to authenticated
  using (reporter_id = (select auth.uid()) or public.is_moderator());

create policy "Users file reports as themselves"
  on public.reports for insert
  to authenticated
  with check (reporter_id = (select auth.uid()) and status = 'open');

create policy "Moderators triage reports"
  on public.reports for update
  to authenticated
  using (public.is_moderator())
  with check (public.is_moderator());

create policy "Moderators read the audit log"
  on public.moderation_actions for select
  to authenticated
  using (public.is_moderator());

-- No update/delete policies: the audit log is append-only.
create policy "Moderators record actions as themselves"
  on public.moderation_actions for insert
  to authenticated
  with check (moderator_id = (select auth.uid()) and public.is_moderator());

create policy "Active plans are public"
  on public.subscription_plans for select
  to anon, authenticated
  using (is_active);

create policy "Users see their own subscriptions"
  on public.user_subscriptions for select
  to authenticated
  using (user_id = (select auth.uid()));
