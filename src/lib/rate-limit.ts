import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export type RateLimitRule = { limit: number; windowSeconds: number };

/** Central catalogue of limits for sensitive operations. */
export const RATE_LIMITS = {
  signIn: { limit: 10, windowSeconds: 5 * 60 },
  signUp: { limit: 5, windowSeconds: 60 * 60 },
  passwordReset: { limit: 5, windowSeconds: 60 * 60 },
  avatarUpload: { limit: 10, windowSeconds: 60 * 60 },
  usernameCheck: { limit: 60, windowSeconds: 60 },
  follow: { limit: 120, windowSeconds: 60 * 60 },
  report: { limit: 20, windowSeconds: 24 * 60 * 60 },
  catalogSearch: { limit: 60, windowSeconds: 60 },
  catalogImport: { limit: 60, windowSeconds: 60 * 60 },
  listWrite: { limit: 300, windowSeconds: 60 * 60 },
  listeningWrite: { limit: 300, windowSeconds: 60 * 60 },
  comment: { limit: 60, windowSeconds: 60 * 60 },
} satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

/** Best-effort client IP, hashed so raw addresses are never stored. */
export async function clientFingerprint(): Promise<string> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

let warned = false;

/**
 * Fixed-window rate limit backed by Postgres (`consume_rate_limit`).
 * `subject` should be a user id for signed-in actions, or the client
 * fingerprint for anonymous ones.
 *
 * If the secret key is not configured (e.g. a fresh local checkout) the limit
 * is skipped with a single warning rather than breaking the app.
 */
export async function checkRateLimit(name: RateLimitName, subject: string) {
  const rule = RATE_LIMITS[name];
  const admin = createAdminClient();
  if (!admin) {
    if (!warned && process.env.NODE_ENV !== "test") {
      console.warn("[rate-limit] SUPABASE_SECRET_KEY not set; rate limiting is disabled.");
      warned = true;
    }
    return { allowed: true as const };
  }

  const { data, error } = await admin
    .rpc("consume_rate_limit", {
      p_key: `${name}:${subject}`,
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
    })
    .single();

  if (error || !data) {
    // Fail open on infrastructure errors so an outage in the limiter does not
    // lock every user out; Supabase Auth keeps its own limits regardless.
    console.error("[rate-limit] check failed", error?.message);
    return { allowed: true as const };
  }

  return data.allowed
    ? { allowed: true as const }
    : { allowed: false as const, resetAt: data.reset_at };
}
