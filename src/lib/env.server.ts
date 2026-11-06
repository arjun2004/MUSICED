import "server-only";

/**
 * Server-only secrets. Importing this module from a Client Component fails the
 * build (via `server-only`), which keeps the secret key out of browser bundles.
 */
export function serverEnv() {
  return {
    supabaseSecretKey:
      process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? null,
    musicbrainzUserAgent:
      process.env.MUSICBRAINZ_USER_AGENT ?? "MUSICED/0.1 ( https://github.com/musiced )",
    lastfmApiKey: process.env.LASTFM_API_KEY || null,
  };
}
