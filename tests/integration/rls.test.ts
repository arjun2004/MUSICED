/**
 * Row Level Security & integrity tests against the LOCAL Supabase stack.
 *
 *   npx supabase start && npm run test:integration
 *
 * Each run creates throwaway users and a throwaway album via the admin API,
 * exercises the database exactly as real clients would (publishable key +
 * user JWT), and removes everything afterwards.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { serverRealtimeOptions } from "@/lib/supabase/realtime-transport";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const SECRET = process.env.SUPABASE_SECRET_KEY ?? "";
const isLocal = /127\.0\.0\.1|localhost/.test(URL);

type Client = SupabaseClient<Database>;
const opts = {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: serverRealtimeOptions(),
};

async function reachable() {
  if (!URL || !PUBLISHABLE || !SECRET || !isLocal) return false;
  try {
    const res = await fetch(`${URL}/auth/v1/health`, { headers: { apikey: PUBLISHABLE } });
    return res.ok;
  } catch {
    return false;
  }
}

const enabled = await reachable();
const run = `t${randomUUID().slice(0, 6)}`;
const PASSWORD = "test-pass-123";

let admin: Client;
let anon: Client;
const users: Record<"alice" | "bob" | "carol", { id: string; client: Client }> = {} as never;
let albumId: string;

async function makeUser(name: "alice" | "bob" | "carol") {
  const email = `${run}-${name}@test.musiced.local`;
  const username = `${run}_${name}`.slice(0, 24);
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { username },
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  await admin.from("profiles").update({ onboarded_at: new Date().toISOString() }).eq("id", data.user.id);
  const client = createClient<Database>(URL, PUBLISHABLE, opts);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  users[name] = { id: data.user.id, client };
}

describe.skipIf(!enabled)("database security (local Supabase)", () => {
  beforeAll(async () => {
    admin = createClient<Database>(URL, SECRET, opts);
    anon = createClient<Database>(URL, PUBLISHABLE, opts);
    await Promise.all([makeUser("alice"), makeUser("bob"), makeUser("carol")]);

    const { data, error } = await admin
      .from("albums")
      .insert({ slug: `${run}-test-album`, title: "Integration Test Album", artist_credit: "Test Artist" })
      .select("id")
      .single();
    if (error) throw error;
    albumId = data.id;

    // bob follows alice; carol does not.
    const { error: followError } = await users.bob.client
      .from("user_follows")
      .insert({ follower_id: users.bob.id, following_id: users.alice.id });
    if (followError) throw followError;
  });

  afterAll(async () => {
    if (!admin) return;
    for (const u of Object.values(users)) await admin.auth.admin.deleteUser(u.id);
    if (albumId) await admin.from("albums").delete().eq("id", albumId);
  });

  describe("profiles", () => {
    it("a user cannot edit someone else's profile", async () => {
      const { data } = await users.bob.client
        .from("profiles")
        .update({ bio: "hacked" })
        .eq("id", users.alice.id)
        .select();
      expect(data).toEqual([]);
      const { data: alice } = await admin.from("profiles").select("bio").eq("id", users.alice.id).single();
      expect(alice?.bio).not.toBe("hacked");
    });

    it("a user cannot grant themselves a moderator role or forge counters", async () => {
      const role = await users.alice.client.from("profiles").update({ role: "admin" }).eq("id", users.alice.id);
      expect(role.error?.code).toBe("42501");
      const counters = await users.alice.client
        .from("profiles")
        .update({ followers_count: 99999 })
        .eq("id", users.alice.id);
      expect(counters.error?.code).toBe("42501");
    });

    it("avatar paths must live in the owner's own storage folder", async () => {
      const { error } = await users.alice.client
        .from("profiles")
        .update({ avatar_path: `${users.bob.id}/stolen.png` })
        .eq("id", users.alice.id);
      expect(error?.code).toBe("23514");
    });

    it("preferences are private to their owner", async () => {
      const { data } = await users.bob.client.from("user_preferences").select("*").eq("user_id", users.alice.id);
      expect(data).toEqual([]);
      const { data: own } = await users.alice.client.from("user_preferences").select("user_id");
      expect(own).toHaveLength(1);
    });
  });

  describe("follows", () => {
    it("prevents following yourself", async () => {
      const { error } = await users.alice.client
        .from("user_follows")
        .insert({ follower_id: users.alice.id, following_id: users.alice.id });
      expect(error?.code).toBe("23514");
    });

    it("prevents following on someone else's behalf", async () => {
      const { error } = await users.carol.client
        .from("user_follows")
        .insert({ follower_id: users.bob.id, following_id: users.carol.id });
      expect(error?.code).toBe("42501");
    });

    it("maintains follower counters server-side and notifies the followee", async () => {
      const { data } = await admin
        .from("profiles")
        .select("followers_count")
        .eq("id", users.alice.id)
        .single();
      expect(data?.followers_count).toBe(1);
      const { data: notes } = await users.alice.client.from("notifications").select("type, actor_id");
      expect(notes).toContainEqual({ type: "followed", actor_id: users.bob.id });
    });
  });

  describe("ratings", () => {
    it.each([0, 4.3, 5.5, -1])("rejects invalid rating %s", async (rating) => {
      const { error } = await users.carol.client
        .from("album_ratings")
        .insert({ user_id: users.carol.id, album_id: albumId, rating });
      expect(error).not.toBeNull();
    });

    it("cannot rate as another user", async () => {
      const { error } = await users.carol.client
        .from("album_ratings")
        .insert({ user_id: users.alice.id, album_id: albumId, rating: 1 });
      expect(error?.code).toBe("42501");
    });

    it("keeps one rating per user per album and maintains aggregates", async () => {
      const a = await users.alice.client
        .from("album_ratings")
        .insert({ user_id: users.alice.id, album_id: albumId, rating: 4.5 })
        .select("id")
        .single();
      expect(a.error).toBeNull();
      const dup = await users.alice.client
        .from("album_ratings")
        .insert({ user_id: users.alice.id, album_id: albumId, rating: 2 });
      expect(dup.error?.code).toBe("23505");

      await users.bob.client.from("album_ratings").insert({ user_id: users.bob.id, album_id: albumId, rating: 3 });
      let { data: stats } = await anon.from("album_stats").select("*").eq("album_id", albumId).single();
      expect(stats?.ratings_count).toBe(2);
      expect(Number(stats?.average_rating)).toBe(3.75);
      expect(stats?.rating_histogram[8]).toBe(1); // 4.5 → index 9 (1-based) → [8]
      expect(stats?.rating_histogram[5]).toBe(1); // 3.0

      // Edit, then remove.
      await users.alice.client.from("album_ratings").update({ rating: 5 }).eq("id", a.data!.id);
      ({ data: stats } = await anon.from("album_stats").select("*").eq("album_id", albumId).single());
      expect(Number(stats?.average_rating)).toBe(4);
      expect(stats?.rating_histogram[8]).toBe(0);
      expect(stats?.rating_histogram[9]).toBe(1);

      await users.bob.client.from("album_ratings").delete().eq("user_id", users.bob.id).eq("album_id", albumId);
      ({ data: stats } = await anon.from("album_stats").select("*").eq("album_id", albumId).single());
      expect(stats?.ratings_count).toBe(1);
      expect(Number(stats?.average_rating)).toBe(5);
    });

    it("clients cannot write aggregates or catalog data", async () => {
      const stats = await users.alice.client.from("album_stats").update({ ratings_count: 1000 }).eq("album_id", albumId);
      expect(stats.error?.code).toBe("42501");
      const album = await users.alice.client
        .from("albums")
        .insert({ slug: `${run}-fake`, title: "Fake", artist_credit: "Nobody" });
      expect(album.error?.code).toBe("42501");
    });
  });

  describe("diary visibility", () => {
    beforeAll(async () => {
      const rows = (["public", "followers", "private"] as const).map((visibility) => ({
        user_id: users.alice.id,
        album_id: albumId,
        visibility,
        note: `note-${visibility}`,
      }));
      const { error } = await users.alice.client.from("listening_logs").insert(rows);
      if (error) throw error;
    });

    const notesVisibleTo = async (client: Client) => {
      const { data } = await client.from("listening_logs").select("note").eq("user_id", users.alice.id);
      return (data ?? []).map((row) => row.note).sort();
    };

    it("owner sees every entry", async () => {
      expect(await notesVisibleTo(users.alice.client)).toEqual(["note-followers", "note-private", "note-public"]);
    });

    it("followers see public + followers-only", async () => {
      expect(await notesVisibleTo(users.bob.client)).toEqual(["note-followers", "note-public"]);
    });

    it("non-followers and anonymous visitors see public only", async () => {
      expect(await notesVisibleTo(users.carol.client)).toEqual(["note-public"]);
      expect(await notesVisibleTo(anon)).toEqual(["note-public"]);
    });

    it("private entries never leak through the activity feed", async () => {
      const visibilities = async (client: Client) => {
        const { data } = await client
          .from("activities")
          .select("visibility")
          .eq("actor_id", users.alice.id)
          .eq("type", "logged");
        return (data ?? []).map((row) => row.visibility).sort();
      };
      expect(await visibilities(anon)).toEqual(["public"]);
      expect(await visibilities(users.carol.client)).toEqual(["public"]);
      expect(await visibilities(users.bob.client)).toEqual(["followers", "public"]);
      expect(await visibilities(users.alice.client)).toEqual(["followers", "private", "public"]);
    });

    it("making an entry private retroactively hides its activity", async () => {
      await users.alice.client
        .from("listening_logs")
        .update({ visibility: "private" })
        .eq("user_id", users.alice.id)
        .eq("note", "note-public");
      const { data } = await anon.from("activities").select("id").eq("actor_id", users.alice.id).eq("type", "logged");
      expect(data).toEqual([]);
    });
  });

  describe("reviews, likes and blocking", () => {
    let publicReview: string;
    let followersReview: string;

    beforeAll(async () => {
      const { data: pub } = await users.alice.client
        .from("reviews")
        .insert({ user_id: users.alice.id, album_id: albumId, body: "Public review" })
        .select("id")
        .single();
      publicReview = pub!.id;
      const { data: fol } = await users.bob.client
        .from("reviews")
        .insert({ user_id: users.bob.id, album_id: albumId, body: "Followers review", visibility: "followers" })
        .select("id")
        .single();
      followersReview = fol!.id;
    });

    it("prevents duplicate likes and keeps like counts server-side", async () => {
      const first = await users.carol.client.from("review_likes").insert({ user_id: users.carol.id, review_id: publicReview });
      expect(first.error).toBeNull();
      const again = await users.carol.client.from("review_likes").insert({ user_id: users.carol.id, review_id: publicReview });
      expect(again.error?.code).toBe("23505");
      const { data } = await anon.from("reviews").select("likes_count").eq("id", publicReview).single();
      expect(data?.likes_count).toBe(1);
      const forged = await users.carol.client.from("reviews").update({ likes_count: 500 }).eq("id", publicReview);
      expect(forged.error?.code).toBe("42501");
    });

    it("cannot like a review you are not allowed to see", async () => {
      // carol does not follow bob, so bob's followers-only review is invisible to her.
      const { error } = await users.carol.client
        .from("review_likes")
        .insert({ user_id: users.carol.id, review_id: followersReview });
      expect(error?.code).toBe("42501");
    });

    it("liking a non-public review does not create a public activity", async () => {
      // alice may see bob's followers review only if she follows bob — she doesn't; make her.
      await users.alice.client.from("user_follows").insert({ follower_id: users.alice.id, following_id: users.bob.id });
      const like = await users.alice.client.from("review_likes").insert({ user_id: users.alice.id, review_id: followersReview });
      expect(like.error).toBeNull();
      const { data } = await admin
        .from("activities")
        .select("id")
        .eq("type", "liked_review")
        .eq("review_id", followersReview);
      expect(data).toEqual([]);
    });

    it("blocking hides content both ways and removes follows", async () => {
      const block = await users.alice.client
        .from("user_blocks")
        .insert({ blocker_id: users.alice.id, blocked_id: users.bob.id });
      expect(block.error).toBeNull();

      const { data: follows } = await admin
        .from("user_follows")
        .select("*")
        .or(`and(follower_id.eq.${users.bob.id},following_id.eq.${users.alice.id}),and(follower_id.eq.${users.alice.id},following_id.eq.${users.bob.id})`);
      expect(follows).toEqual([]);

      const { data: bobSees } = await users.bob.client.from("reviews").select("id").eq("id", publicReview);
      expect(bobSees).toEqual([]);
      const { data: aliceSees } = await users.alice.client.from("album_ratings").select("id").eq("user_id", users.bob.id);
      expect(aliceSees).toEqual([]);

      // Bob cannot re-follow, and only alice can see that the block exists.
      const refollow = await users.bob.client
        .from("user_follows")
        .insert({ follower_id: users.bob.id, following_id: users.alice.id });
      expect(refollow.error?.code).toBe("42501");
      const { data: bobBlocks } = await users.bob.client.from("user_blocks").select("*");
      expect(bobBlocks).toEqual([]);
    });
  });

  describe("system-only functions", () => {
    it("clients cannot call the rate limiter", async () => {
      const { error } = await users.alice.client.rpc("consume_rate_limit", {
        p_key: "signIn:victim",
        p_limit: 1,
        p_window_seconds: 3600,
      });
      expect(error).not.toBeNull();
    });

    it("clients cannot read the provider cache", async () => {
      const { data, error } = await anon.from("provider_cache").select("*");
      expect(error?.code === "42501" || (data ?? []).length === 0).toBe(true);
    });
  });
});

if (!enabled) {
  describe("database security (local Supabase)", () => {
    it.skip("skipped: start the local stack with `npx supabase start` and set .env.local", () => {});
  });
}
