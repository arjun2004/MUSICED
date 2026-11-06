import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { publicEnv } from "@/lib/env";
import { serverRealtimeOptions } from "@/lib/supabase/realtime-transport";

/**
 * Cookie-less client acting as the anonymous role. Safe to use inside
 * `"use cache"` scopes because its results never depend on who is asking:
 * RLS returns only what an anonymous visitor may see.
 */
export function createPublicClient() {
  const env = publicEnv();
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      realtime: serverRealtimeOptions(),
    },
  );
}
