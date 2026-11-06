import WebSocket from "ws";
import type { RealtimeClientOptions } from "@supabase/supabase-js";

/**
 * supabase-js constructs a Realtime client eagerly, which requires a global
 * WebSocket. Node 22+ provides one natively; on older Node (e.g. Node 20,
 * end-of-life April 2026) we fall back to the `ws` package, as documented by
 * Supabase. Server-side only — browsers always have WebSocket.
 */
export function serverRealtimeOptions(): RealtimeClientOptions | undefined {
  if (typeof globalThis.WebSocket !== "undefined") return undefined;
  return { transport: WebSocket as unknown as NonNullable<RealtimeClientOptions["transport"]> };
}
