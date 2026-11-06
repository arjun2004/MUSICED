# Development status

_Last updated: 2026-11-06 — Phases 1–6 complete (payments intentionally deferred)._

## ✅ Completed — Phase 1

**Project & tooling**
- Next.js 16.4 (App Router, Cache Components, Partial Prefetching), React 19.3, TS strict, Tailwind v4,
  shadcn/ui (Radix), Lucide, motion, TanStack Query, RHF + Zod, date-fns, Recharts installed.
- Local Supabase via CLI (Postgres 17); generated DB types; Vitest.

**Design system**
- Dark-first tokens (charcoal `#151719` / `#202428`, lime signal `#A3E635`), Geist + Geist Mono "liner-note" labels.
- Components: Logo/mark, AlbumCover (honest no-artwork fallback), AlbumCard/Grid, CoverMosaic, GroovePattern,
  StarRating (display) + StarRatingInput (half-star, keyboard slider), RatingHistogram, UserAvatar,
  Section/Page headers, Empty/Error states, skeletons, FormField, ActivityItem, ReviewCard (spoiler blur),
  ListenerRow, FollowButton (optimistic).
- Responsive shell: sticky header, active nav, account menu, mobile bottom tab bar, footer with attribution,
  skip link, reduced-motion support.

**Database (8 migrations, all tables from the spec)**
- User, catalog, listening, social, lists, moderation, subscription domains; storage buckets; rate limits.
- RLS + explicit column-level grants on every table; trigger-maintained counters, album stats,
  activities, notifications (with preferences, blocks, @mentions).

**Auth & profiles**
- Email/password signup (username chosen at signup, live availability check), login, logout,
  email confirmation, password reset, Google OAuth (behind a flag), branded email templates.
- 4-step onboarding: profile → avatar upload → favorite genres → follow suggestions (genre overlap).
- Profiles: header, follow/unfollow, block/unblock, followers/following pages, stats, rating histogram,
  favorite genres, favorite albums, recent diary, reviews.
- Settings: profile + avatar, taste, privacy defaults & notification preferences, account/password.
- Discover homepage: visitor hero with real artwork mosaic; member feed (following → community fallback),
  suggestions, trending, highest rated, fresh reviews, recently active.
- Listeners directory with debounced search + pagination.

**Verification**
- `tsc` and ESLint: clean. `next build`: succeeds.
- 25 unit tests + 25 RLS integration tests passing (privacy of diary/activities, forged writes,
  roles/counters, blocks, aggregates, likes).
- Smoke-tested against the production build: all routes, protected-route redirects, signup →
  confirmation email → `/auth/confirm` → onboarding → settings/profile.

## ✅ Completed — Moderation, polish & production readiness (migration 1100)

- **Moderation console** `/admin/moderation` (moderators/admins only; others get 404): report queue
  grouped by target with previews, actions with mandatory reasons (dismiss, hide, restore, delete,
  suspend/unsuspend author), closed reports, append-only audit log. One audited RPC: `moderate_content`.
- **Hidden content** (`hidden_at` on reviews/comments/lists): invisible to everyone except author and
  staff, including feed activities. **Suspensions** (`profiles.suspended_at`): read-only accounts via
  write-blocking triggers, clear error messages, site-wide banner.
- **Lists**: drag-and-drop reordering (`@dnd-kit`: mouse, touch, keyboard) alongside the move buttons;
  custom cover uploads (magic-byte validated, own storage folder) replacing the collage.
- **Profile showcase** `/settings/favorites`: pick and order the four pinned albums (`set_favorite_showcase`).
- **Account deletion** (Settings → Account): username + password confirmation, removes uploads, cascades
  all user data. Staff accounts are protected (they anchor the audit log).
- **Security**: Content-Security-Policy (see ARCHITECTURE "CSP"), HSTS, frame/sniff/referrer/permissions
  headers. **Monitoring**: structured `onRequestError` logs + optional `ERROR_WEBHOOK_URL` forwarding.
  **SEO**: sitemap, robots, per-page metadata, `MusicAlbum` JSON-LD with aggregate ratings.
- **Cache Components correctness**: session-bound reads are explicitly request-time; relative times render
  client-side — removes all "unstable value" prerender errors seen under runtime prefetch.
- **Browser E2E (Playwright)**: 8 journeys — visitor browsing, protected redirects, signup → email confirm →
  6-step onboarding, rate + log + review + add-to-list, ranked list build & reorder, commenting with
  notification, moderator hides a reported review, non-staff 404 — plus responsive snapshots at 390px and
  1440px with a no-horizontal-overflow assertion on 7 key pages. All passing.
- Tests: **103 unit/integration + 10 E2E passing**.

## ✅ Completed — Personal, social & discovery (migration 1000)

**Personal (Phase 3)**
- Album page actions: instant half-star rating (edit/remove), **Log a listen** dialog (date, rating, note,
  re-listen, loved, visibility), **Review** editor (headline, body, attached rating, spoilers, visibility,
  edit/delete), **Favourite** toggle that auto-pins to the profile top-4 (`add_favorite_album`).
- Diary: `/user/[username]/diary` — chronological, grouped by month, year filter, pagination, owner
  edit/delete; `/diary` shortcut. Reviews tab `/user/[username]/reviews`.
- Profile: Diary/Reviews tabs, listening chart (Recharts, colour validated with the dataviz validator),
  favourite artists.

**Social (Phase 4)**
- `/review/[id]`: full review (mentions linked, spoiler guard), likes, threaded comments (reply, edit,
  delete — review owners can moderate their thread), comment likes, share, report.
- Notifications page (all 7 types) + header bell with **live unread count via Supabase Realtime**;
  mark all read (`mark_all_notifications_read`).
- Reporting dialog for reviews, comments and profiles (private, de-duplicated, rate limited).

**Discovery (Phase 5)**
- `/explore`: sort (top/popular/trending/new/recent) × filters (genre, decade, year, country) with facet
  counts — all server-rendered links (`browse_albums`, `explore_facets`).
- `/charts`: Bayesian-ranked top rated / most popular, same filters.
- Artist pages `/artist/[slug]` (stats, MUSICED albums, full MusicBrainz discography cached 7 days),
  artist search tab, `/artist/import/[mbid]`, album credits link to artists.
- Homepage: recommended for you (genre-based, excludes what you've heard), new releases, popular lists,
  featured reviews, plus existing trending / highest rated / fresh reviews / feed.
- Onboarding now 6 steps: profile → photo → genres → **favourite artists** → **rate a few albums** → follow.

**Production (Phase 6, partial)**
- `sitemap.xml` (public content only, as seen anonymously), `robots.txt`, `instrumentation.ts`
  `onRequestError` structured error logging (no PII; ready to forward to Sentry).

**Verification**: 96 tests passing (15 new: favourite slots, charts ranking & privacy, artists, comments
nesting/moderation, mentions privacy, reports privacy, notification ownership). Build clean. Smoke-tested
signed-out and signed-in (as dev user): album actions, owner-only diary controls, private diary entries
hidden from visitors (18 vs 15), notifications, artist import (Thom Yorke), explore/charts content.

## ✅ Completed — Catalog & lists (migration 0900)

- **Provider layer** `src/lib/music-providers/`: provider-neutral types, MusicBrainz adapter (1 req/s queue,
  retries/backoff on 503, User-Agent, 10 s timeouts), Cover Art Archive resolver, slugs.
- **Ingestion** `ingest_album(jsonb)` (service role only): one transaction, advisory lock per external id,
  idempotent via `catalog_sources`, reuses artists, unique slugs, tracks, genres.
- **Search** `search_albums()` (every word must match, trigram-ranked, wildcard-safe) + catalog-first
  search with MusicBrainz fallback cached 24 h in `provider_cache`.
- **Pages**: `/search`, `/album/[slug]` (artwork wash, credits, rating + histogram, tracklist, genres,
  reviews, "in lists", related albums, add to list, share), `/album/import/[mbid]` (import → redirect).
- **Lists**: `/lists` (popular + recent), `/lists/new`, `/list/[id]` (ranked countdown or grid, notes,
  like, share), `/list/[id]/edit` (details, add via search incl. MusicBrainz import, reorder top/up/down/
  bottom, notes, remove, delete), profile Lists tab, "Add to a list" dialog on album pages.
  Atomic `append_list_item` / `reorder_list_items` RPCs run as the caller (RLS applies).
- Nav: Discover · Albums · Lists · Listeners. Album links wired everywhere.
- Tests: 81 passing (26 new: mappers, ingestion idempotence, search, list ownership/order/privacy/likes).
- Smoke-tested on the dev server: real MusicBrainz search, real import (OK Computer), album page,
  list pages, protected editor routes.

## ⏳ Not yet verified

- Google OAuth end-to-end (needs real Google credentials).
- Realtime bell receiving a live push (subscription code is in place; not exercised by E2E).
- Production deploy on Vercel + hosted Supabase (all local; see README "Deploying").

## 🔜 Next (deferred by decision)

1. **Payments** — Stripe/Razorpay checkout + webhooks writing `user_subscriptions` (tables and RLS exist).
2. Hash-based CSP (Next SRI) once stable, to drop `'unsafe-inline'` for scripts.
3. At catalog scale: materialise Bayesian scores for `browse_albums`; schedule `purge_expired_cache()` (pg_cron).
4. Move `scripts/generate-dev-seed.mjs` onto the provider layer.

## ⚠️ Known issues / decisions to revisit
- ~~Logging + rating + reviewing an album showed up as separate feed items~~ — fixed: `collapseFeed` merges same-listener/same-album actions within 30 min (DB still stores each activity).
- `notFound()` in streamed routes may return HTTP 200 (PPR); consider a pre-check for SEO.
- CSP allows inline scripts (required without nonces under PPR) — see ARCHITECTURE.
- `purge_expired_cache()` exists but isn't scheduled; add pg_cron in production.
- Profile rating histogram reads up to 10k ratings client-side of the DB; move to an SQL function.
- Node 20 is EOL; prefer Node 22+ (supabase-js warns on 20).
