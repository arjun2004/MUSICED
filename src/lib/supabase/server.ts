import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "@/types/database";
import { publicEnv } from "@/lib/env";
import { serverRealtimeOptions } from "@/lib/supabase/realtime-transport";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Acts as the signed-in user (publishable key + session cookie), so every
 * query is subject to Row Level Security.
 *
 * Reads cookies, so callers must render behind a <Suspense> boundary.
 */
export async function createClient() {
  // Session-bound queries are per-request by nature, and supabase-js checks
  // token expiry against the clock — which Cache Components forbids during
  // (runtime) prerenders. Opt out explicitly; cached public reads use
  // createPublicClient() instead.
  await connection();
  const cookieStore = await cookies();
  const env = publicEnv();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      realtime: serverRealtimeOptions(),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // The proxy refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  );
}

export type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;
