import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import { serverRealtimeOptions } from "@/lib/supabase/realtime-transport";

/**
 * Privileged Supabase client (secret / service-role key). Bypasses RLS.
 *
 * ONLY for system operations that no user owns:
 *   - catalog ingestion from music providers
 *   - provider response caching
 *   - rate limiting
 *   - billing webhooks
 *
 * Never use it to read or write user-owned data on a user's behalf.
 * Returns null when the key is not configured.
 */
export function createAdminClient() {
  const { supabaseSecretKey } = serverEnv();
  if (!supabaseSecretKey) return null;

  return createClient<Database>(publicEnv().NEXT_PUBLIC_SUPABASE_URL, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: serverRealtimeOptions(),
  });
}
