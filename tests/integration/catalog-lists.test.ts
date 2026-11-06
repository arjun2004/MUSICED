/**
 * Catalog ingestion, album search and list operations against LOCAL Supabase.
 * Uses a fake provider id ("testprov") so nothing touches real catalog rows.
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
const run = `c${randomUUID().slice(0, 6)}`;
const word = `zq${randomUUID().replace(/-/g, "").slice(0, 8)}`; // unique search token
let admin: Client;
let anon: Client;
const users: Record<"owner" | "fan" | "stranger", { id: string; client: Client }> = {} as never;
const albumIds: string[] = [];

function payload(n: number, overrides: Record<string, unknown> = {}) {
  return {
    provider: "testprov",
    external_id: `${run}-album-${n}`,
    url: `https://example.test/album/${n}`,
    title: `${word} Album ${n}`,
    artist_credit: n === 1 ? "Duo One & Duo Two" : `Solo ${word}`,
    album_type: "album",
    secondary_types: [],
    release_date: "1999-05",
    release_year: 1999,
    cover_url: null,
    cover_status: "missing",
    slug_base: `${run}-same-slug`,
    artists:
      n === 1
        ? [
            { external_id: `${run}-artist-a`, name: "Duo One", credited_name: "Duo One", join_phrase: " & ", slug_base: `${run}-duo-one` },
            { external_id: `${run}-artist-b`, name: "Duo Two", credited_name: "Duo Two", join_phrase: "", slug_base: `${run}-duo-two` },
          ]
        : [{ external_id: `${run}-artist-a`, name: "Duo One", credited_name: "Duo One", join_phrase: "", slug_base: `${run}-duo-one` }],
    tracks: [
      { disc_number: 1, position: 1, number: "1", title: "First", duration_ms: 1000, recording_mbid: null },
      { disc_number: 1, position: 2, number: "2", title: "Second", duration_ms: 2000, recording_mbid: null },
    ],
    genres: [{ slug: `${run}-genre`, name: "Test Genre", weight: 3 }],
    ...overrides,
  };
}

async function makeUser(name: keyof typeof users) {
  const email = `${run}-${name}@test.musiced.local`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "test-pass-123",
    email_confirm: true,
    user_metadata: { username: `${run}_${name}`.slice(0, 24) },
  });
  if (error || !data.user) throw error;
  const client = createClient<Database>(URL, PUBLISHABLE, opts);
  await client.auth.signInWithPassword({ email, password: "test-pass-123" });
  users[name] = { id: data.user.id, client };
}

describe.skipIf(!enabled)("catalog ingestion & lists (local Supabase)", () => {
  beforeAll(async () => {
    admin = createClient<Database>(URL, SECRET, opts);
    anon = createClient<Database>(URL, PUBLISHABLE, opts);
    await Promise.all([makeUser("owner"), makeUser("fan"), makeUser("stranger")]);
    await users.fan.client.from("user_follows").insert({ follower_id: users.fan.id, following_id: users.owner.id });
  });

  afterAll(async () => {
    if (!admin) return;
    for (const u of Object.values(users)) await admin.auth.admin.deleteUser(u.id);
    if (albumIds.length) await admin.from("albums").delete().in("id", albumIds);
    const { data: artists } = await admin
      .from("catalog_sources")
      .select("entity_id")
      .eq("provider", "testprov")
      .eq("entity_type", "artist");
    if (artists?.length) await admin.from("artists").delete().in("id", artists.map((a) => a.entity_id));
    await admin.from("genres").delete().eq("slug", `${run}-genre`);
  });

  describe("ingest_album", () => {
    it("creates an album with ordered multi-artist credits, tracks and genres", async () => {
      const { data: id, error } = await admin.rpc("ingest_album", { p: payload(1) });
      expect(error).toBeNull();
      albumIds.push(id!);

      const { data: album } = await admin
        .from("albums")
        .select("slug, artist_credit, track_count, duration_ms, album_artists(position, join_phrase), tracks(id), album_genres(weight)")
        .eq("id", id!)
        .single();
      expect(album?.slug).toBe(`${run}-same-slug`);
      expect(album?.artist_credit).toBe("Duo One & Duo Two");
      expect(album?.track_count).toBe(2);
      expect(album?.duration_ms).toBe(3000);
      expect(album?.album_artists.sort((a, b) => a.position - b.position).map((a) => a.join_phrase)).toEqual([" & ", ""]);
      expect(album?.tracks).toHaveLength(2);
      expect(album?.album_genres[0].weight).toBe(3);
    });

    it("is idempotent: re-ingesting returns the same album", async () => {
      const { data: again } = await admin.rpc("ingest_album", { p: payload(1) });
      expect(again).toBe(albumIds[0]);
      const { count } = await admin
        .from("catalog_sources")
        .select("id", { head: true, count: "exact" })
        .eq("provider", "testprov")
        .eq("external_id", `${run}-album-1`);
      expect(count).toBe(1);
    });

    it("reuses existing artists and de-duplicates slugs", async () => {
      const { data: id } = await admin.rpc("ingest_album", { p: payload(2) });
      albumIds.push(id!);
      const { data } = await admin.from("albums").select("slug").eq("id", id!).single();
      expect(data?.slug).toBe(`${run}-same-slug-2`);
      const { count } = await admin
        .from("catalog_sources")
        .select("id", { head: true, count: "exact" })
        .eq("provider", "testprov")
        .eq("entity_type", "artist");
      expect(count).toBe(2);
    });

    it("cannot be called by clients", async () => {
      const asUser = await users.owner.client.rpc("ingest_album", { p: payload(3) });
      expect(asUser.error).not.toBeNull();
      const asAnon = await anon.rpc("ingest_album", { p: payload(4) });
      expect(asAnon.error).not.toBeNull();
    });
  });

  describe("search_albums", () => {
    it("matches every word in any order across title and artist", async () => {
      const { data } = await anon.rpc("search_albums", { p_query: `duo ${word} one`, p_limit: 10 });
      expect(data?.map((a) => a.id)).toContain(albumIds[0]);
      const { data: none } = await anon.rpc("search_albums", { p_query: `${word} nonexistentword`, p_limit: 10 });
      expect(none).toEqual([]);
    });

    it("treats LIKE wildcards literally", async () => {
      const { data } = await anon.rpc("search_albums", { p_query: "%_", p_limit: 10 });
      expect(data).toEqual([]);
    });
  });

  describe("lists", () => {
    let publicList: string;
    let privateList: string;
    let followersList: string;
    const items: string[] = [];

    beforeAll(async () => {
      const make = async (visibility: "public" | "private" | "followers") => {
        const { data, error } = await users.owner.client
          .from("user_lists")
          .insert({ user_id: users.owner.id, title: `${visibility} list`, visibility, is_ranked: true })
          .select("id")
          .single();
        if (error) throw error;
        return data.id;
      };
      [publicList, privateList, followersList] = await Promise.all([make("public"), make("private"), make("followers")]);
      for (const albumId of albumIds) {
        const { data, error } = await users.owner.client.rpc("append_list_item", { p_list_id: publicList, p_album_id: albumId });
        if (error) throw error;
        items.push(data);
      }
      await users.owner.client.rpc("append_list_item", { p_list_id: privateList, p_album_id: albumIds[0] });
      await users.owner.client.rpc("append_list_item", { p_list_id: followersList, p_album_id: albumIds[0] });
    });

    it("appends in order and maintains the item counter", async () => {
      const { data } = await anon.from("list_items").select("id, position").eq("list_id", publicList).order("position");
      expect(data?.map((i) => i.id)).toEqual(items);
      expect(data?.map((i) => i.position)).toEqual([1, 2]);
      const { data: list } = await anon.from("user_lists").select("items_count").eq("id", publicList).single();
      expect(list?.items_count).toBe(2);
    });

    it("rejects duplicate albums in a list", async () => {
      const { error } = await users.owner.client.rpc("append_list_item", { p_list_id: publicList, p_album_id: albumIds[0] });
      expect(error?.code).toBe("23505");
    });

    it("only the owner can add, reorder or edit items", async () => {
      const add = await users.stranger.client.rpc("append_list_item", { p_list_id: publicList, p_album_id: albumIds[0] });
      expect(add.error?.code).toBe("42501");
      const reorder = await users.stranger.client.rpc("reorder_list_items", { p_list_id: publicList, p_item_ids: [...items].reverse() });
      expect(reorder.error?.code).toBe("42501");
      const { data: edited } = await users.stranger.client.from("list_items").update({ note: "hijack" }).eq("id", items[0]).select();
      expect(edited).toEqual([]);
      const { data: renamed } = await users.stranger.client.from("user_lists").update({ title: "pwned" }).eq("id", publicList).select();
      expect(renamed).toEqual([]);
    });

    it("reorders atomically and validates the new order", async () => {
      const reversed = [...items].reverse();
      const ok = await users.owner.client.rpc("reorder_list_items", { p_list_id: publicList, p_item_ids: reversed });
      expect(ok.error).toBeNull();
      const { data } = await anon.from("list_items").select("id").eq("list_id", publicList).order("position");
      expect(data?.map((i) => i.id)).toEqual(reversed);

      const missing = await users.owner.client.rpc("reorder_list_items", { p_list_id: publicList, p_item_ids: [items[0]] });
      expect(missing.error?.code).toBe("22023");
      const dupes = await users.owner.client.rpc("reorder_list_items", { p_list_id: publicList, p_item_ids: [items[0], items[0]] });
      expect(dupes.error?.code).toBe("22023");
    });

    it("private lists and their items are invisible to everyone else", async () => {
      for (const client of [anon, users.fan.client, users.stranger.client]) {
        const { data: lists } = await client.from("user_lists").select("id").eq("id", privateList);
        expect(lists).toEqual([]);
        const { data: listItems } = await client.from("list_items").select("id").eq("list_id", privateList);
        expect(listItems).toEqual([]);
      }
      const { data: own } = await users.owner.client.from("list_items").select("id").eq("list_id", privateList);
      expect(own).toHaveLength(1);
    });

    it("followers-only lists are visible to followers only", async () => {
      const { data: fan } = await users.fan.client.from("list_items").select("id").eq("list_id", followersList);
      expect(fan).toHaveLength(1);
      const { data: stranger } = await users.stranger.client.from("list_items").select("id").eq("list_id", followersList);
      expect(stranger).toEqual([]);
    });

    it("likes: allowed on visible lists, rejected on hidden ones, counted server-side", async () => {
      const like = await users.stranger.client.from("list_likes").insert({ user_id: users.stranger.id, list_id: publicList });
      expect(like.error).toBeNull();
      const hidden = await users.stranger.client.from("list_likes").insert({ user_id: users.stranger.id, list_id: privateList });
      expect(hidden.error?.code).toBe("42501");
      const { data } = await anon.from("user_lists").select("likes_count").eq("id", publicList).single();
      expect(data?.likes_count).toBe(1);
      const forged = await users.stranger.client.from("user_lists").update({ likes_count: 999 }).eq("id", publicList);
      expect(forged.error?.code).toBe("42501");
    });

    it("making a list private hides its creation activity from the public", async () => {
      await users.owner.client.from("user_lists").update({ visibility: "private" }).eq("id", publicList);
      const { data } = await anon.from("activities").select("id").eq("list_id", publicList);
      expect(data).toEqual([]);
    });
  });
});

if (!enabled) {
  describe("catalog ingestion & lists (local Supabase)", () => {
    it.skip("skipped: start the local stack with `npx supabase start`", () => {});
  });
}
