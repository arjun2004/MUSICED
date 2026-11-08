import { NextResponse, connection } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Liveness + configuration check. Exposes no data and never echoes secrets:
 * - database:  one trivial query as the anonymous role
 * - secretKey: whether SUPABASE_SECRET_KEY is set AND accepted by this project
 *   (needed for album/artist imports, search caching and rate limiting)
 */
export async function GET() {
  await connection(); // always run at request time, never prerendered/cached
  const started = Date.now();
  const headers = { "Cache-Control": "no-store" };

  try {
    const supabase = createPublicClient();
    const { error } = await supabase.from("genres").select("id", { head: true, count: "exact" }).limit(1);
    const latencyMs = Date.now() - started;
    if (error) {
      return NextResponse.json({ status: "degraded", database: "error", error: error.message, latencyMs }, { status: 503, headers });
    }

    const secretKey = await checkSecretKey();
    return NextResponse.json(
      { status: secretKey === "ok" ? "ok" : "degraded", database: "ok", secretKey, latencyMs },
      { headers },
    );
  } catch (err) {
    return NextResponse.json({ status: "down", database: "unreachable", error: (err as Error).message }, { status: 503, headers });
  }
}

/** "ok" | "missing" | "invalid" — provider_cache is readable only with the real secret key. */
async function checkSecretKey(): Promise<"ok" | "missing" | "invalid"> {
  const admin = createAdminClient();
  if (!admin) return "missing";
  const { error } = await admin.from("provider_cache").select("cache_key", { head: true, count: "exact" }).limit(1);
  return error ? "invalid" : "ok";
}
