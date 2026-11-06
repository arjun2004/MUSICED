# MUSICED — Technical Architecture

## Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js 16.4 (App Router, **Cache Components** + Partial Prefetching) | React 19.3, TypeScript strict |
| UI | Tailwind CSS v4, shadcn/ui (Radix base), Lucide, `motion` (Framer Motion) | Dark-first design tokens in `src/app/globals.css` |
| Data | Supabase: Postgres 17, Auth, Storage, Realtime | RLS on every user-facing table |
| Client state | TanStack Query (client fetches), React Hook Form + Zod | Same Zod schemas validate on client and server |
| Metadata | MusicBrainz (CC0) + Cover Art Archive | Release groups = albums |
| Tests | Vitest (unit + RLS integration against local Supabase) | |

## Directory layout

```
src/
  app/
    (main)/            Shell with header/footer: Discover (/), /members, /user/[username], /settings/*
    (auth)/            Focused layout: /login, /signup, /forgot-password, /reset-password
    onboarding/        Multi-step setup wizard
    auth/callback      PKCE code exchange (OAuth, same-browser email links)
    auth/confirm       token_hash verification (email links on any device)
  components/          Presentational components (albums, layout, profile, reviews, shared, social, ui)
  features/<domain>/   actions.ts (Server Actions) · queries.ts (data access) · components/
  lib/
    supabase/          server.ts · client.ts · proxy.ts · public.ts · admin.ts
    auth/session.ts    Data Access Layer: getViewer / requireViewer / requireOnboardedProfile
    validation/        Zod schemas (shared by forms and actions)
    rate-limit.ts      Postgres-backed fixed-window limiter
  proxy.ts             Session refresh + coarse route gating (Next 16 replacement for middleware)
  types/database.ts    Generated from the live schema (`npm run db:types`)
supabase/
  migrations/          Ordered, idempotent-on-reset schema migrations (0100 → 0800)
  templates/           Branded auth emails
  seed.sql             DEV ONLY — real catalog from MusicBrainz + fake users
```

Rule of thumb: **pages compose, features own data, components render.** Pages never call Supabase directly
except for trivial single-row reads in settings.

## Rendering model (Cache Components)

- The static shell (header, page chrome, cached public rails) is prerendered.
- Anything that reads cookies, `params` or `searchParams` sits behind `<Suspense>` and streams in.
  Reading the session outside a boundary is a build error under Cache Components — this is intentional.
- Public aggregates with no viewer dependence (`getHighestRatedAlbums`, `getTrendingAlbums`, `getHeroCovers`,
  genres, profile metadata) use `"use cache"` + `cacheLife` with a **cookie-less anonymous client**
  (`lib/supabase/public.ts`), so cached results can never contain one user's private data.
- Viewer-dependent reads (feeds, reviews, profile stats) use the session client so RLS, visibility and
  blocks apply. They are memoised per request with React `cache()`.

## Supabase clients — which one, when

| Client | Key | RLS | Use |
| --- | --- | --- | --- |
| `server.ts` | publishable + user cookie | ✅ | Server Components, Server Actions, Route Handlers |
| `client.ts` | publishable + browser session | ✅ | Client Components (realtime, uploads later) |
| `public.ts` | publishable, no session | ✅ (as `anon`) | Inside `"use cache"` |
| `admin.ts` | **secret** | ❌ bypass | System tasks only: catalog ingestion, provider cache, rate limits, billing webhooks |

The secret key is read only in `env.server.ts` (guarded by `server-only`) and is never `NEXT_PUBLIC_`.

## Security model

1. **Identity** comes from `supabase.auth.getClaims()` (JWT signature verified). Server Actions ignore any
   client-provided user id; ownership columns are always set from the session.
2. **RLS everywhere.** Policies use viewer-centric helpers (`can_view`, `viewer_follows`,
   `viewer_blocked_with`) that only answer questions about `auth.uid()`, so they can't be used to probe
   third-party relationships.
3. **Column-level privileges.** Counters (`likes_count`, `followers_count`…), `role`, ownership columns and
   timestamps are not grantable to clients. Aggregates (`album_stats`) are written only by triggers.
4. **Triggers own derived data.** Activities, notifications, counters and album stats are produced by
   `SECURITY DEFINER` functions in the unexposed `private` schema.
5. **Visibility propagation.** Every activity carries its source's visibility and is updated when the
   source changes. "Liked X" activities are owned by the liker, so they're only created for *public*
   content and deleted when that content stops being public (prevents audience mismatch leaks).
6. **Blocks** hide content in both directions, remove follows, and suppress notifications.
7. **Uploads** are checked for size, declared MIME *and* magic bytes, written as the user (Storage RLS
   restricts writes to `<uid>/…`), and the DB constrains `avatar_path` to the owner's folder.
8. **Rate limits** for auth, uploads, follows and reports via `consume_rate_limit` (service-role only).
   Supabase Auth's own limits apply as well.
9. **Open-redirect protection** on every `next=` parameter (`safeRedirectPath`).
10. **Security headers** (HSTS, nosniff, frame-deny, referrer, permissions policy) in `next.config.ts`.

## Data model highlights

- `albums` = MusicBrainz **release groups**; the representative **release** (tracklist, label) is recorded
  in `catalog_sources` with `entity_type='release'`. `tracks` store `recording_mbid`.
- `album_artists` supports multi-artist credits with ordered `join_phrase`s; `albums.artist_credit` keeps
  the display string exactly as credited.
- `catalog_sources (provider, entity_type, external_id)` is unique → re-ingesting never duplicates.
- Ratings: `star_rating` domain (0.5–5.0, half steps). One current rating per user/album
  (`album_ratings`) is separate from any number of diary entries (`listening_logs`).
- One main review per user per album (unique constraint) — relaxable later.
- `album_stats` keeps count, sum, a 10-bucket histogram and a generated average.

## Decisions & trade-offs

| Decision | Why |
| --- | --- |
| Keep Cache Components on | Framework default in Next 16.4; gives instant static shells. Cost: every request-time read needs a Suspense boundary. |
| Profiles always public (basic fields) | Needed to render authors/comments; privacy is per item (diary, reviews, lists). |
| Ratings always public | Matches community-average semantics; diary entries carry the privacy. |
| Album pages not linked yet | Album/artist pages ship in Phase 2; `AlbumCard` takes an optional `href`. |
| `ws` fallback transport | supabase-js needs a global WebSocket (Node 22+). Fallback keeps Node 20 working. |
| Profile log/review counts computed via RLS-filtered counts | Visitors never learn how many private entries exist. |
| `notFound()` inside Suspense | Streams the not-found UI but HTTP status may be 200 on dynamic routes (PPR limitation). Revisit for SEO. |
| CSP without nonces | Nonce-based CSP is incompatible with Partial Prerendering (static shells can't carry per-request nonces). Shipped Next's documented no-nonce policy: `script-src 'self' 'unsafe-inline'`, everything else locked to our origins (no plugins/frames/foreign scripts or connections). SRI hash-based CSP is experimental in Next 16; revisit when stable. |
| Session client is request-time | `createClient()` (cookie-bound) calls `await connection()`: supabase-js reads the clock to validate tokens, which Cache Components forbids during runtime prefetch/prerender. Public cached reads use `createPublicClient()`. Relative timestamps render via the `<RelativeTime>` client component for the same reason. |
| Moderation via one RPC | `moderate_content()` is the only way to hide/restore/delete content or (un)suspend accounts; it authorises, applies, writes the append-only `moderation_actions` row and closes reports in one transaction. Hidden content stays visible to its author and staff. Suspended accounts are blocked from writes by triggers. |
