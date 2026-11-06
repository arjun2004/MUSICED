/**
 * Moderation tooling, suspensions and the favourite showcase against LOCAL Supabase.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { serverRealtimeOptions } from "@/lib/supabase/realtime-transport";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const SECRET = process.env.SUPABASE_SECRET_KEY ?? "";
const opts = { auth: { persistSession: false, autoRefreshToken: false }, realtime: serverRealtimeOptions() };

async function reachable() {
  if (!URL || !PUBLISHABLE || !SECRET || !/127\.0\.0\.1|localhost/.test(URL)) return false;
  try {
    return (await fetch(`${URL}/auth/v1/health`, { headers: { apikey: PUBLISHABLE } })).ok;
  } catch {
    return false;
  }
}
const enabled = await reachable();

type Client = SupabaseClient<Database>;
const run = `m${randomUUID().slice(0, 6)}`;
let admin: Client;
let anon: Client;
const u: Record<"mod" | "author" | "user", { id: string; client: Client }> = {} as never;
const albums: string[] = [];

async function makeUser(name: keyof typeof u) {
  const email = `${run}-${name}@test.musiced.local`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "test-pass-123",
    email_confirm: true,
    user_metadata: { username: `${run}_${name}` },
  });
  if (error || !data.user) throw error;
  const client = createClient<Database>(URL, PUBLISHABLE, opts);
  await client.auth.signInWithPassword({ email, password: "test-pass-123" });
  u[name] = { id: data.user.id, client };
}

describe.skipIf(!enabled)("moderation & showcase (local Supabase)", () => {
  let review: string;

  beforeAll(async () => {
    admin = createClient<Database>(URL, SECRET, opts);
    anon = createClient<Database>(URL, PUBLISHABLE, opts);
    await Promise.all([makeUser("mod"), makeUser("author"), makeUser("user")]);
    await admin.from("profiles").update({ role: "moderator" }).eq("id", u.mod.id);
    for (let i = 1; i <= 5; i++) {
      const { data } = await admin.rpc("ingest_album", {
        p: { provider: "testprov", external_id: `${run}-${i}`, title: `${run} LP ${i}`, artist_credit: "Band", slug_base: `${run}-lp-${i}` },
      });
      albums.push(data!);
    }
    const { data } = await u.author.client
      .from("reviews")
      .insert({ user_id: u.author.id, album_id: albums[0], body: "Reported review" })
      .select("id")
      .single();
    review = data!.id;
    await u.user.client.from("reports").insert({ reporter_id: u.user.id, target_type: "review", target_id: review, reason: "spam" });
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("moderation_actions").delete().eq("moderator_id", u.mod.id);
    for (const x of Object.values(u)) await admin.auth.admin.deleteUser(x.id);
    if (albums.length) await admin.from("albums").delete().in("id", albums);
  });

  it("only moderators can moderate, and a reason is required", async () => {
    const asUser = await u.user.client.rpc("moderate_content", {
      p_action: "hide_content", p_target_type: "review", p_target_id: review, p_reason: "nope",
    });
    expect(asUser.error?.code).toBe("42501");
    const noReason = await u.mod.client.rpc("moderate_content", {
      p_action: "hide_content", p_target_type: "review", p_target_id: review, p_reason: "  ",
    });
    expect(noReason.error?.code).toBe("22023");
  });

  it("hiding a review removes it (and its activity) for everyone but author and staff, and closes reports", async () => {
    const { error } = await u.mod.client.rpc("moderate_content", {
      p_action: "hide_content", p_target_type: "review", p_target_id: review, p_reason: "spam",
    });
    expect(error).toBeNull();

    expect((await anon.from("reviews").select("id").eq("id", review)).data).toEqual([]);
    expect((await u.user.client.from("reviews").select("id").eq("id", review)).data).toEqual([]);
    expect((await u.author.client.from("reviews").select("id").eq("id", review)).data).toHaveLength(1);
    expect((await u.mod.client.from("reviews").select("id").eq("id", review)).data).toHaveLength(1);
    expect((await anon.from("activities").select("id").eq("review_id", review)).data).toEqual([]);

    const { data: report } = await admin.from("reports").select("status, resolved_by").eq("target_id", review).single();
    expect(report).toEqual({ status: "resolved", resolved_by: u.mod.id });

    const { data: log } = await u.mod.client.from("moderation_actions").select("action, reason").eq("target_id", review);
    expect(log).toEqual([{ action: "hide_content", reason: "spam" }]);
    // Append-only: the audit trail cannot be edited or erased by staff.
    const { data: erased } = await u.mod.client.from("moderation_actions").delete().eq("target_id", review).select();
    expect(erased ?? []).toEqual([]);
  });

  it("authors cannot unhide their own content", async () => {
    const { error } = await u.author.client.from("reviews").update({ hidden_at: null } as never).eq("id", review);
    expect(error?.code).toBe("42501");
  });

  it("restoring brings it back", async () => {
    await u.mod.client.rpc("moderate_content", {
      p_action: "restore_content", p_target_type: "review", p_target_id: review, p_reason: "appeal accepted",
    });
    expect((await anon.from("reviews").select("id").eq("id", review)).data).toHaveLength(1);
  });

  it("suspended accounts can read but not write, until unsuspended", async () => {
    await u.mod.client.rpc("moderate_content", {
      p_action: "suspend_user", p_target_type: "profile", p_target_id: u.author.id, p_reason: "repeat spam",
    });
    const blocked = await u.author.client.from("album_ratings").insert({ user_id: u.author.id, album_id: albums[1], rating: 4 });
    expect(blocked.error?.message).toMatch(/suspended/);
    const read = await u.author.client.from("albums").select("id").eq("id", albums[1]);
    expect(read.data).toHaveLength(1);

    await u.mod.client.rpc("moderate_content", {
      p_action: "unsuspend_user", p_target_type: "profile", p_target_id: u.author.id, p_reason: "served time",
    });
    const allowed = await u.author.client.from("album_ratings").insert({ user_id: u.author.id, album_id: albums[1], rating: 4 });
    expect(allowed.error).toBeNull();
  });

  it("staff cannot be suspended and moderators cannot act on their own content", async () => {
    const staff = await u.mod.client.rpc("moderate_content", {
      p_action: "suspend_user", p_target_type: "profile", p_target_id: u.mod.id, p_reason: "test",
    });
    expect(staff.error).not.toBeNull();
  });

  it("set_favorite_showcase orders up to four pins and rejects bad input", async () => {
    const pick = [albums[3], albums[1], albums[4]];
    expect((await u.user.client.rpc("set_favorite_showcase", { p_album_ids: pick })).error).toBeNull();
    const { data } = await u.user.client
      .from("favorite_albums")
      .select("album_id, position")
      .eq("user_id", u.user.id)
      .not("position", "is", null)
      .order("position");
    expect(data?.map((r) => r.album_id)).toEqual(pick);

    const tooMany = await u.user.client.rpc("set_favorite_showcase", { p_album_ids: albums });
    expect(tooMany.error?.code).toBe("22023");
    const dupes = await u.user.client.rpc("set_favorite_showcase", { p_album_ids: [albums[0], albums[0]] });
    expect(dupes.error?.code).toBe("22023");
  });
});

if (!enabled) {
  describe("moderation & showcase (local Supabase)", () => {
    it.skip("skipped: start the local stack with `npx supabase start`", () => {});
  });
}
