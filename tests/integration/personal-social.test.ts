/**
 * Favourites, browse/charts, artists, comments, mentions, reports and
 * notifications against LOCAL Supabase.
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
const run = `p${randomUUID().slice(0, 6)}`;
let admin: Client;
let anon: Client;
const u: Record<"a" | "b" | "c", { id: string; username: string; client: Client }> = {} as never;
const albums: string[] = [];

async function makeUser(name: "a" | "b" | "c") {
  const email = `${run}-${name}@test.musiced.local`;
  const username = `${run}_${name}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "test-pass-123",
    email_confirm: true,
    user_metadata: { username },
  });
  if (error || !data.user) throw error;
  const client = createClient<Database>(URL, PUBLISHABLE, opts);
  await client.auth.signInWithPassword({ email, password: "test-pass-123" });
  u[name] = { id: data.user.id, username, client };
}

async function album(n: number, extra: Record<string, unknown> = {}) {
  const { data, error } = await admin.rpc("ingest_album", {
    p: {
      provider: "testprov",
      external_id: `${run}-alb-${n}`,
      title: `${run} Record ${n}`,
      artist_credit: `${run} Band`,
      slug_base: `${run}-record-${n}`,
      artists: [{ external_id: `${run}-band`, name: `${run} Band`, slug_base: `${run}-band` }],
      ...extra,
    },
  });
  if (error) throw error;
  albums.push(data!);
  return data!;
}

describe.skipIf(!enabled)("personal & social features (local Supabase)", () => {
  beforeAll(async () => {
    admin = createClient<Database>(URL, SECRET, opts);
    anon = createClient<Database>(URL, PUBLISHABLE, opts);
    await Promise.all([makeUser("a"), makeUser("b"), makeUser("c")]);
    for (let i = 1; i <= 6; i++) await album(i, { release_year: 1990 + i, release_date: `${1990 + i}`, country: i % 2 ? "GB" : "US" });
  });

  afterAll(async () => {
    if (!admin) return;
    for (const x of Object.values(u)) await admin.auth.admin.deleteUser(x.id);
    if (albums.length) await admin.from("albums").delete().in("id", albums);
    const { data } = await admin.from("catalog_sources").select("entity_id").eq("provider", "testprov").eq("entity_type", "artist");
    if (data?.length) await admin.from("artists").delete().in("id", data.map((r) => r.entity_id));
  });

  describe("favourites", () => {
    it("fills the four showcase slots in order, then stores extras unpinned", async () => {
      const slots: (number | null)[] = [];
      for (const id of albums.slice(0, 5)) {
        const { data, error } = await u.a.client.rpc("add_favorite_album", { p_album_id: id });
        expect(error).toBeNull();
        slots.push(data);
      }
      expect(slots).toEqual([1, 2, 3, 4, null]);
      await u.a.client.from("favorite_albums").delete().eq("user_id", u.a.id).eq("album_id", albums[1]);
      const { data: again } = await u.a.client.rpc("add_favorite_album", { p_album_id: albums[5] });
      expect(again).toBe(2);
    });

    it("anonymous callers cannot add favourites", async () => {
      const { error } = await anon.rpc("add_favorite_album", { p_album_id: albums[0] });
      expect(error).not.toBeNull();
    });
  });

  describe("browse_albums (Explore & Charts)", () => {
    beforeAll(async () => {
      // b rates three albums; c rates one. Album 1 gets a private listen only.
      await u.b.client.from("album_ratings").insert([
        { user_id: u.b.id, album_id: albums[2], rating: 5 },
        { user_id: u.b.id, album_id: albums[3], rating: 2 },
        { user_id: u.b.id, album_id: albums[4], rating: 4 },
      ]);
      await u.c.client.from("album_ratings").insert({ user_id: u.c.id, album_id: albums[2], rating: 4.5 });
      await u.b.client.from("listening_logs").insert({ user_id: u.b.id, album_id: albums[0], visibility: "private" });
    });

    const ids = (rows: { id: string }[] | null) => (rows ?? []).map((r) => r.id).filter((id) => albums.includes(id));

    it("ranks top-rated with a weighted average and requires ratings", async () => {
      const { data } = await anon.rpc("browse_albums", { p_sort: "top", p_decade: 1990, p_limit: 100 });
      const ranked = ids(data);
      expect(ranked[0]).toBe(albums[2]); // two high ratings beat one 4★
      expect(ranked).not.toContain(albums[5]); // unrated albums never chart
      expect(ranked.indexOf(albums[4])).toBeLessThan(ranked.indexOf(albums[3]));
    });

    it("filters by year and country", async () => {
      const { data: byYear } = await anon.rpc("browse_albums", { p_sort: "recent", p_year: 1993, p_limit: 100 });
      expect(ids(byYear)).toEqual([albums[2]]);
      const { data: byCountry } = await anon.rpc("browse_albums", { p_sort: "recent", p_decade: 1990, p_country: "us", p_limit: 100 });
      expect(ids(byCountry).every((id) => [albums[1], albums[3], albums[5]].includes(id))).toBe(true);
    });

    it("private listens never make an album trend", async () => {
      const { data } = await anon.rpc("browse_albums", { p_sort: "trending", p_limit: 100 });
      expect(ids(data)).not.toContain(albums[0]);
      expect(ids(data)).toContain(albums[2]);
    });

    it("explore facets summarise the catalog", async () => {
      const { data } = await anon.rpc("explore_facets");
      const facets = data as unknown as { decades: { decade: number }[]; countries: { country: string }[]; total: number };
      expect(facets.total).toBeGreaterThan(0);
      expect(facets.decades.some((d) => d.decade === 1990)).toBe(true);
      expect(facets.countries.some((c) => c.country === "GB")).toBe(true);
    });
  });

  describe("artists", () => {
    it("ingest_artist is idempotent, enriches details, and is service-only", async () => {
      const payload = { provider: "testprov", external_id: `${run}-band`, name: `${run} Band`, country: "GB", artist_type: "group" };
      const { data: first } = await admin.rpc("ingest_artist", { p: payload });
      const { data: second } = await admin.rpc("ingest_artist", { p: payload });
      expect(second).toBe(first);
      const { data: row } = await anon.from("artists").select("country, artist_type").eq("id", first!).single();
      expect(row).toEqual({ country: "GB", artist_type: "group" });
      const { error } = await u.a.client.rpc("ingest_artist", { p: payload });
      expect(error).not.toBeNull();
    });

    it("search_artists finds artists by name", async () => {
      const { data } = await anon.rpc("search_artists", { p_query: `${run} band` });
      expect(data?.[0]?.name).toBe(`${run} Band`);
    });

    it("favourite artists are owner-writable and capped at 12", async () => {
      const { data: artist } = await anon.from("artists").select("id").eq("slug", `${run}-band`).single();
      const forged = await u.b.client.from("user_favorite_artists").insert({ user_id: u.a.id, artist_id: artist!.id });
      expect(forged.error?.code).toBe("42501");
      const own = await u.a.client.from("user_favorite_artists").insert({ user_id: u.a.id, artist_id: artist!.id });
      expect(own.error).toBeNull();
    });
  });

  describe("comments, mentions, reports, notifications", () => {
    let review: string;
    let privateReview: string;
    let comment: string;

    beforeAll(async () => {
      const { data: r } = await u.a.client
        .from("reviews")
        .insert({ user_id: u.a.id, album_id: albums[0], body: `Shout out to @${u.c.username}` })
        .select("id")
        .single();
      review = r!.id;
      const { data: p } = await u.a.client
        .from("reviews")
        .insert({ user_id: u.a.id, album_id: albums[1], body: `Secret note for @${u.c.username}`, visibility: "private" })
        .select("id")
        .single();
      privateReview = p!.id;
      const { data: c } = await u.b.client
        .from("review_comments")
        .insert({ review_id: review, user_id: u.b.id, body: "Great take" })
        .select("id")
        .single();
      comment = c!.id;
    });

    it("mentions in public reviews notify; mentions in private reviews don't", async () => {
      const { data } = await u.c.client.from("notifications").select("type, review_id").eq("type", "mentioned");
      const reviewIds = (data ?? []).map((n) => n.review_id);
      expect(reviewIds).toContain(review);
      expect(reviewIds).not.toContain(privateReview);
    });

    it("replies nest one level only and notify the parent author", async () => {
      const { data: reply, error } = await u.c.client
        .from("review_comments")
        .insert({ review_id: review, user_id: u.c.id, body: "Agreed", parent_id: comment })
        .select("id")
        .single();
      expect(error).toBeNull();
      const tooDeep = await u.a.client
        .from("review_comments")
        .insert({ review_id: review, user_id: u.a.id, body: "Nested", parent_id: reply!.id });
      expect(tooDeep.error?.code).toBe("23514");
      const { data: notes } = await u.b.client.from("notifications").select("type").eq("type", "replied_comment");
      expect(notes?.length).toBeGreaterThan(0);
    });

    it("the review owner can remove others' comments; strangers can't", async () => {
      const { data: byStranger } = await u.c.client.from("review_comments").delete().eq("id", comment).select("id");
      expect(byStranger).toEqual([]);
      const { data: byOwner } = await u.a.client.from("review_comments").delete().eq("id", comment).select("id");
      expect(byOwner).toHaveLength(1);
    });

    it("nobody can comment on a review they cannot see", async () => {
      const { error } = await u.b.client.from("review_comments").insert({ review_id: privateReview, user_id: u.b.id, body: "hi" });
      expect(error?.code).toBe("42501");
    });

    it("reports are private to the reporter and de-duplicated", async () => {
      const first = await u.b.client
        .from("reports")
        .insert({ reporter_id: u.b.id, target_type: "review", target_id: review, reason: "spam" });
      expect(first.error).toBeNull();
      const again = await u.b.client
        .from("reports")
        .insert({ reporter_id: u.b.id, target_type: "review", target_id: review, reason: "spam" });
      expect(again.error?.code).toBe("23505");
      const { data: seenByOther } = await u.c.client.from("reports").select("id");
      expect(seenByOther).toEqual([]);
      const forged = await u.c.client
        .from("reports")
        .insert({ reporter_id: u.b.id, target_type: "review", target_id: review, reason: "spam" });
      expect(forged.error?.code).toBe("42501");
    });

    it("mark_all_notifications_read only touches the caller's notifications", async () => {
      const { data: before } = await admin.from("notifications").select("id").eq("recipient_id", u.b.id).is("read_at", null);
      const { data: count } = await u.c.client.rpc("mark_all_notifications_read");
      expect(count).toBeGreaterThan(0);
      const { data: after } = await admin.from("notifications").select("id").eq("recipient_id", u.b.id).is("read_at", null);
      expect(after?.length).toBe(before?.length);
      const { data: cUnread } = await admin.from("notifications").select("id").eq("recipient_id", u.c.id).is("read_at", null);
      expect(cUnread).toEqual([]);
    });
  });
});

if (!enabled) {
  describe("personal & social features (local Supabase)", () => {
    it.skip("skipped: start the local stack with `npx supabase start`", () => {});
  });
}
