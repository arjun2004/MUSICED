# MUSICED — Project context

A handover/memory document: what exists, how it fits together, and the non-obvious lessons learned
while building it. Read this first when picking the project back up (human or AI).
Companion docs: [ARCHITECTURE.md](ARCHITECTURE.md) · [DEPLOYMENT.md](DEPLOYMENT.md) ·
[../DEVELOPMENT_STATUS.md](../DEVELOPMENT_STATUS.md) · [../README.md](../README.md)

_Last updated: 2026-11-06._

---

## 1. What MUSICED is

A social network for music: listening diary, half-star ratings, reviews, lists, follows and an activity
feed, built on a real catalog from MusicBrainz + Cover Art Archive. Inspired by Letterboxd / RYM / AOTY
but with its own identity: dark charcoal (#151719 / #202428), a single lime accent (#A3E635), Geist +
Geist Mono "liner-note" labels, album artwork as the main visual.

**Status:** all roadmap phases 1–6 are built. **Payments are deliberately not built** (the
`subscription_plans` / `user_subscriptions` tables and RLS exist, waiting for Stripe/Razorpay).

## 2. Stack (versions matter — see §6)

| | |
|---|---|
| App | Next.js **16.4** App Router, **Cache Components + Partial Prefetching on**, React 19.3, TypeScript strict |
| UI | Tailwind v4, shadcn/ui (Radix, "radix-nova" style, `cn` package), Lucide, `motion`, `@dnd-kit`, Recharts |
| Data | Supabase (Postgres 17, Auth, Storage, Realtime) via `@supabase/ssr` 0.12 / `supabase-js` 2.109 |
| Forms | React Hook Form + Zod 4 (same schemas on client and server) |
| Tests | Vitest (unit + RLS integration) · Playwright (browser journeys + responsive snapshots) |
| Catalog | MusicBrainz WS/2 (release groups = albums), Cover Art Archive |

## 3. Feature map (where things live)

| Area | Routes | Code |
|---|---|---|
| Auth | `/login` `/signup` `/forgot-password` `/reset-password` `/auth/callback` `/auth/confirm` | `features/authentication` |
| Onboarding (6 steps) | `/onboarding` | `features/onboarding` |
| Discover home | `/` | `app/(main)/page.tsx`, `features/discovery` |
| Search · Explore · Charts | `/search` `/explore` `/charts` | `features/catalog`, `features/discovery` |
| Album · Artist | `/album/[slug]` `/artist/[slug]` · imports `/album/import/[mbid]` `/artist/import/[mbid]` | `features/catalog`, `lib/music-providers` |
| Rate / log / review / favourite | album page panel | `features/listening` |
| Diary · Reviews | `/user/[u]/diary` `/user/[u]/reviews` `/diary` | `features/listening` |
| Review page, comments, likes | `/review/[id]` | `features/reviews` |
| Lists | `/lists` `/lists/new` `/list/[id]` `/list/[id]/edit` `/user/[u]/lists` | `features/lists` |
| Profiles & social | `/user/[u]` (+followers/following) `/members` | `features/profile`, `features/social` |
| Notifications | `/notifications` + header bell (Realtime) | `features/notifications` |
| Settings | `/settings` (+taste, favorites, preferences, account) | `features/profile` |
| Moderation | `/admin/moderation` (staff only, 404 otherwise) | `features/moderation` |
| SEO / ops | `/sitemap.xml` `/robots.txt` `/api/health`, `src/instrumentation.ts` | |

## 4. Database (11 migrations in `supabase/migrations`)

`0100 foundation` · `0200 users` · `0300 catalog` · `0400 listening` · `0500 lists` · `0600 social` ·
`0700 moderation & subscriptions` · `0800 storage & rate limits` · `0900 ingest, search, list RPCs` ·
`1000 favourite artists, browse/charts, favourites, notifications` · `1100 moderation tools, suspensions, showcase`.

Key ideas:
- **RLS on every table + column-level grants.** Clients can't write counters, roles, `hidden_at`,
  `suspended_at`, or catalog rows. Ownership columns are insert-only.
- **Viewer-centric helpers** in policies: `can_view(owner, visibility)`, `viewer_follows`, `viewer_blocked_with`, `is_moderator`.
- **Triggers own derived data**: album stats (count/sum/histogram/average), counters, activities,
  notifications (respecting prefs/blocks), mentions. All in the unexposed `private` schema.
- **Visibility propagates**: activities copy their source's visibility; "liked X" activities exist only for public content.
- **RPCs**: `ingest_album`/`ingest_artist` (service role only, idempotent via `catalog_sources`),
  `search_albums`/`search_artists`, `browse_albums` (Bayesian top/popular/trending/new/recent + filters),
  `explore_facets`, `append_list_item`/`reorder_list_items`, `add_favorite_album`/`set_favorite_showcase`,
  `mark_all_notifications_read`, `moderate_content` (single audited staff entry point), `consume_rate_limit` (service role).
- Types are generated: `npm run db:types` → `src/types/database.ts`. Regenerate after any migration.

## 5. Conventions

- **pages compose, `features/*` own data (`queries.ts`, `actions.ts`), `components/*` render.**
- Server Actions return `ActionResult` (`lib/action-result.ts`); identity always from `getViewer()`
  (`lib/auth/session.ts`, verified JWT via `getClaims()`), never from client ids.
- Supabase clients: `server.ts` (session, RLS) · `client.ts` (browser) · `public.ts` (cookie-less anon,
  safe inside `"use cache"`) · `admin.ts` (secret key — catalog ingestion, rate limits, account deletion only).
- Use `assertQuery(error, label)` for reads (treats aborted requests as empty, throws real errors).
- Rate limits live in `lib/rate-limit.ts` (`RATE_LIMITS`).
- Charts use the validated `--chart-bar` (#6aa81a) token, not raw lime (lime fails the dark lightness band).

## 6. Gotchas learned the hard way

1. **Next 16 + Cache Components**: any `cookies()`/`params`/`searchParams` read must sit inside
   `<Suspense>` (or `loading.tsx`). Reading the clock (`Date.now()`, `new Date()`) in server code during a
   prerender — including runtime prefetch — is an error. Hence: `createClient()` and `getViewer()` call
   `await connection()`; relative times use the `<RelativeTime>` client component; date-window queries call `connection()`.
2. **`middleware.ts` is now `proxy.ts`** (`src/proxy.ts`, export `proxy`).
3. **`revalidateTag(tag)` needs a 2nd arg** in Next 16; in Server Actions prefer `updateTag(tag)` (read-your-own-writes).
4. **`next/image` `priority` is deprecated** → use `loading="eager"` / `fetchPriority="high"`.
5. **supabase-js needs a global WebSocket** (Node 22+). `lib/supabase/realtime-transport.ts` falls back to `ws` on Node 20. Prefer Node 22+.
6. **Turbopack dev HMR can serve stale server modules** after functions are appended to a file
   ("X is not a function"). Restart `npm run dev`; production builds are unaffected.
7. **Supabase local config changes** (email templates, auth settings) need `npx supabase stop && npx supabase start`.
8. **Column-level REVOKE doesn't override a table-level GRANT** in Postgres — grant columns explicitly.
9. **CSP**: nonce-based CSP is incompatible with PPR; we ship a no-nonce CSP (`'unsafe-inline'` scripts). See ARCHITECTURE.
10. **Rate limits are real in tests too** — E2E helpers clear `signIn:`/`signUp:` buckets locally.
11. **Genres are referenced by slug** between client and server (ids change on `db reset`; cached lists went stale).
12. **List editor autosaves** album add/move/remove; "Save details" is only for title/description/ranked/visibility.
14. **Onboarding "rate a few albums"** suggests by favourite artists first (catalog, then their MusicBrainz
    discography — imported only when rated via `rateSuggestedAlbum`), then genre matches; never unrelated filler.
15. **Production catalog starts empty** — fill it with `npm run catalog:warm -- <site-url>` (uses the site's own
    import route). "Invalid API key" in Vercel logs = wrong `SUPABASE_SECRET_KEY`.
16. **Icons** come from `src/app/icon.svg`; regenerate favicon/apple/PWA/OG images with `npm run icons:generate`.
17. Prerendered rails (`browseAlbums`, trending, hero covers) return `[]` on DB errors so builds never fail on a DB outage.
13. Windows/Git-Bash shells mangle backslashes in inline scripts — write files with an editor/Python when exact escapes matter.

## 7. Local development

```bash
npm install
npx supabase start          # Docker Desktop must be running
npx supabase db reset       # migrations + DEV seed (real MusicBrainz catalog, fake users)
npm run dev                 # http://localhost:3000 (or the next free port)
npm test                    # unit + integration (needs local Supabase)
npm run build && npm run test:e2e   # Playwright (first time: npx playwright install chromium)
```

Dev accounts: `ava` (admin), `kofi`, `mei`, `leo`, `priya`, `sam` — `<name>@dev.musiced.local` / `musiced-dev-1`.
Local Studio http://127.0.0.1:54323 · Mailpit http://127.0.0.1:54324 · health http://localhost:3000/api/health.
Apply a new migration without wiping data: `npx supabase migration up`.

## 8. What's left

- Payments (Stripe/Razorpay) — intentionally deferred.
- Hosted deployment (see DEPLOYMENT.md), Google OAuth with real credentials, verifying the Realtime bell live.
- Nothing is committed to git yet beyond the initial scaffold commit.
