# MUSICED

**Discover. Listen. Rate. Repeat.** A social network for music discovery: a listening diary, half-star
ratings, reviews, lists, and a feed built from people whose taste you trust.

Built with Next.js 16 (App Router, Cache Components), TypeScript, Tailwind v4, shadcn/ui and Supabase.
See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md).

## Requirements

- **Node.js 22 LTS or newer recommended** (Node 20 works via a `ws` fallback but is end-of-life)
- Docker Desktop (for the local Supabase stack)

## Local setup

```bash
npm install
cp .env.example .env.local          # then fill in keys from the next step
npx supabase start                  # first run downloads the Supabase images
npx supabase status                 # copy "Publishable" and "Secret" keys into .env.local
npx supabase db reset               # applies migrations + DEV seed data
npm run dev                         # http://localhost:3000
```

Local service URLs: Studio http://127.0.0.1:54323 · Mailpit (captured emails) http://127.0.0.1:54324

### Development accounts (seed data only)

`ava`, `kofi`, `mei`, `leo`, `priya`, `sam` — email `<name>@dev.musiced.local`, password `musiced-dev-1`.
`ava` is an **admin** in the dev seed, so `/admin/moderation` can be tried locally.
The seeded **catalog is real MusicBrainz data**; the users, ratings, diary entries and reviews are fake
fixtures. Never run `supabase/seed.sql` against production. Regenerate with `npm run seed:generate`.

## Environment variables

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | public | Canonical URL; auth redirects and metadata |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public | Publishable key (legacy anon key also accepted via `NEXT_PUBLIC_SUPABASE_ANON_KEY`) |
| `SUPABASE_SECRET_KEY` | **server only** | Catalog ingestion, rate limiting, webhooks. Optional locally; rate limits are skipped without it |
| `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED` | public | `true` to show Google sign-in (configure the provider first) |
| `MUSICBRAINZ_USER_AGENT` | server | Required by MusicBrainz: `App/Version ( contact-url-or-email )` |
| `LASTFM_API_KEY` | server | Optional, future enrichment |
| `ERROR_WEBHOOK_URL` | server | Optional. Server errors are POSTed here as JSON (Sentry/Better Stack/Slack ingest) |

### Google OAuth (optional)

1. Create an OAuth client in Google Cloud. Authorized redirect URI: `https://<project>.supabase.co/auth/v1/callback`
   (locally `http://127.0.0.1:54321/auth/v1/callback`).
2. Hosted: enable Google under Supabase → Authentication → Providers. Local: put
   `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `_SECRET` in `supabase/.env` and set `enabled = true` under
   `[auth.external.google]` in `supabase/config.toml`, then restart Supabase.
3. Set `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` · `npm run typecheck` | ESLint · route typegen + `tsc` |
| `npm test` | Unit + integration tests (integration runs only if local Supabase is up) |
| `npm run test:unit` · `npm run test:integration` | Individually |
| `npm run build && npm run test:e2e` | Playwright browser journeys + responsive snapshots (needs local Supabase + seed; first run: `npx playwright install chromium`) |
| `npm run db:reset` | Re-apply all migrations + seed locally |
| `npm run db:types` | Regenerate `src/types/database.ts` from the local schema |
| `npm run seed:generate` | Rebuild `supabase/seed.sql` from MusicBrainz |

## Deploying (Vercel + Supabase)

1. Create a Supabase project; `npx supabase link --project-ref <ref>` then `npx supabase db push`
   (never run `seed.sql` there).
2. In Supabase Auth settings set Site URL to your domain and add `https://<domain>/auth/callback` and
   `https://<domain>/auth/confirm` to redirect URLs. Paste `supabase/templates/*.html` into the
   Confirm signup and Reset password email templates. Configure production SMTP.
3. In Vercel, set the environment variables above (Node.js 22+ runtime) and deploy.

## Attribution

Music metadata © MusicBrainz contributors, CC0. Cover art via the Cover Art Archive; artwork remains the
property of its owners.
