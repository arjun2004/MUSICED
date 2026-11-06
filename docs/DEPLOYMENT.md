# Deploying MUSICED (Supabase + Vercel)

Order: **1. Supabase project → 2. database → 3. auth & email verification → 4. Vercel → 5. first admin & smoke test.**
Never run `supabase/seed.sql` in production — it contains fake development users.

---

## 1. Create the Supabase project

1. Go to https://supabase.com/dashboard → **New project**.
2. Pick an organisation, a name (e.g. `musiced`), a **strong database password** (save it in a password
   manager) and the **region closest to your users**. Use the same region family for Vercel functions later.
3. Wait for provisioning, then note from **Project Settings**:
   - **Project ref** (General → Reference ID)
   - **Project URL** `https://<ref>.supabase.co`
   - **API keys**: the **publishable** key (`sb_publishable_…`) and a **secret** key (`sb_secret_…`).
     The secret key is server-only — never put it in a `NEXT_PUBLIC_` variable.

## 2. Push the database schema

From the project folder (the Supabase CLI is already a dev dependency):

```bash
npx supabase login                          # opens the browser once
npx supabase link --project-ref <ref>       # asks for the database password
npx supabase db push                        # applies supabase/migrations/* in order
npx supabase migration list                 # local and remote columns should match
```

`db push` applies only the migrations (tables, RLS, functions, triggers, storage buckets `avatars` and
`list-covers`, genre reference data). It does **not** run `seed.sql`.

Then regenerate types against production only if you changed the schema there (normally not needed):
`npx supabase gen types typescript --linked --schema public > src/types/database.ts`.

Optional but recommended:
- **Cache housekeeping** — Database → Extensions → enable `pg_cron`, then in the SQL editor:
  ```sql
  select cron.schedule('musiced-purge-cache', '0 3 * * *', $$ select private.purge_expired_cache() $$);
  ```
- **Backups** — daily backups are included on paid plans; enable Point-in-Time Recovery if you need it.

The production catalog starts empty apart from genres: albums and artists are imported on demand when
people search (`/search`) or open discographies. That needs `SUPABASE_SECRET_KEY` and a
`MUSICBRAINZ_USER_AGENT` with real contact details on Vercel (step 4).

## 3. Authentication & email verification

MUSICED already implements verification end to end: signup → confirmation email → `/auth/confirm`
verifies the token → user lands in `/onboarding`. Password reset works the same way to
`/reset-password`. In production you only need to configure Supabase:

### 3a. Turn on email confirmation
**Authentication → Sign In / Providers → Email**: keep the Email provider enabled and **"Confirm email"
ON**. Recommended: minimum password length **8** with **letters and digits** required (matches the app's
validation).

### 3b. URLs
**Authentication → URL Configuration**:
- **Site URL**: `https://your-domain.com` (or your `*.vercel.app` URL until you add a domain).
- **Redirect URLs** — add:
  - `https://your-domain.com/auth/callback`
  - `https://your-domain.com/auth/confirm`
  - for Vercel preview deployments: `https://*-<your-vercel-team>.vercel.app/**`

The email templates build links from the Site URL, so it must be the real public address.

### 3c. Email templates
**Authentication → Emails → Templates**:
- **Confirm signup**: subject `Confirm your MUSICED account`, body = contents of `supabase/templates/confirmation.html`.
- **Reset password**: subject `Reset your MUSICED password`, body = contents of `supabase/templates/recovery.html`.

These templates link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=…`, which works
even when the email is opened on a different device or browser than the one used to sign up.

### 3d. Custom SMTP (required for real users)
Supabase's built-in email sender is for testing only: it is heavily rate limited and won't deliver
reliably to arbitrary addresses. Use a real provider:

1. Create an account with an email provider (e.g. Resend, Postmark, Amazon SES, SendGrid, Brevo).
2. **Verify your sending domain** with the provider: add the DNS records it gives you (SPF, DKIM, and a
   DMARC record such as `v=DMARC1; p=none; rua=mailto:you@your-domain.com`). Without these, mail lands in spam.
3. In Supabase: **Authentication → Emails → SMTP Settings** → enable custom SMTP and enter host, port,
   username, password from the provider, sender address `no-reply@your-domain.com`, sender name `MUSICED`.
4. **Authentication → Rate Limits**: raise "emails sent per hour" to suit your expected signups
   (the app adds its own per-IP limits on signup, login and password reset).

### 3e. Test it
Sign up on the deployed site with a real inbox → you should see "Check your inbox" → click the email
button → you land on `/onboarding` signed in. Also test **Forgot password**. If a link says "invalid or
expired", check the Site URL / Redirect URLs (3b) and that you pasted the templates (3c).

### 3f. Google sign-in (optional)
Create an OAuth client in Google Cloud with redirect URI `https://<ref>.supabase.co/auth/v1/callback`,
paste the client ID/secret under **Authentication → Sign In / Providers → Google**, then set
`NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true` on Vercel.

## 4. Vercel

1. Push the repository to GitHub/GitLab and **Import** it in Vercel (framework: Next.js, auto-detected).
2. **Settings → General → Node.js Version: 22.x or newer** (supabase-js targets Node 22+).
3. **Settings → Environment Variables** (Production, and Preview if you use previews):

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_SITE_URL` | `https://your-domain.com` |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` |
   | `SUPABASE_SECRET_KEY` | `sb_secret_…` (**not** NEXT_PUBLIC) |
   | `MUSICBRAINZ_USER_AGENT` | `MUSICED/1.0 ( https://your-domain.com; you@your-domain.com )` |
   | `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED` | `false` (or `true` after 3f) |
   | `ERROR_WEBHOOK_URL` | optional — URL that receives server errors as JSON |

   These are read at **build time** too (the Content-Security-Policy embeds the Supabase origin), so
   redeploy after changing them.
4. Deploy. Then **Settings → Domains** to add your domain, and update `NEXT_PUBLIC_SITE_URL` and the
   Supabase Site URL / Redirect URLs to match. Redeploy.

## 5. After the first deploy

1. Check `https://your-domain.com/api/health` → `{"status":"ok","database":"ok",…}`.
2. Sign up with your own account and finish onboarding.
3. Make yourself an admin (Supabase → **SQL Editor**):
   ```sql
   update public.profiles set role = 'admin' where username = 'your_username';
   ```
   The **Moderation** link appears in your account menu (`/admin/moderation`).
4. Search for a few albums on `/search` to start the catalog; open some artists to pull discographies.
5. Submit `https://your-domain.com/sitemap.xml` in Google Search Console.

## Updating later

- Schema change: add a new file in `supabase/migrations/` (never edit applied ones), test locally with
  `npx supabase migration up`, then `npx supabase db push`, then deploy the app.
- App change: push to the main branch; Vercel builds and deploys automatically.
