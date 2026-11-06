import { NextResponse, connection } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Liveness + database connectivity check. Runs one trivial RLS-respecting
 * query as the anonymous role and reports latency. Exposes no data.
 */
export async function GET() {
  await connection(); // always run at request time, never prerendered/cached
  const started = Date.now();
  try {
    const supabase = createPublicClient();
    const { error } = await supabase.from("genres").select("id", { head: true, count: "exact" }).limit(1);
    const latencyMs = Date.now() - started;
    if (error) {
      return NextResponse.json(
        { status: "degraded", database: "error", error: error.message, latencyMs },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { status: "ok", database: "ok", latencyMs },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      { status: "down", database: "unreachable", error: (err as Error).message },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
