import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { FollowListEntry } from "@/features/profile/queries";
import { assertQuery } from "@/lib/supabase/errors";

const FIELDS = "id, username, display_name, avatar_path, bio, followers_count";

/** Directory of listeners, optionally filtered by a search term. */
export async function listMembers({
  search,
  page = 1,
  pageSize = 24,
}: {
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;

  let query = supabase
    .from("profiles")
    .select(FIELDS, { count: "exact" })
    .not("username", "is", null)
    .not("onboarded_at", "is", null);

  const term = search?.trim().toLowerCase().replace(/[%_,()\\]/g, "");
  if (term) {
    query = query.or(`username.ilike.%${term}%,display_name.ilike.%${term}%`);
  }

  const { data, error, count } = await query
    .order("followers_count", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  assertQuery(error, `listeners`);
  return { people: (data ?? []) as FollowListEntry[], total: count ?? 0, page, pageSize };
}

/**
 * Suggest listeners to follow: people who share the viewer's favorite genres
 * first, then the most-followed listeners. Excludes self, people already
 * followed, and anyone across a block (RLS hides blocked users' rows from
 * user_favorite_genres joins via profiles visibility on the client side).
 */
export async function getSuggestedListeners(viewerId: string, limit = 6): Promise<FollowListEntry[]> {
  const supabase = await createClient();

  const [{ data: follows }, { data: myGenres }, { data: blocks }] = await Promise.all([
    supabase.from("user_follows").select("following_id").eq("follower_id", viewerId).limit(1000),
    supabase.from("user_favorite_genres").select("genre_id").eq("user_id", viewerId),
    supabase.from("user_blocks").select("blocked_id").eq("blocker_id", viewerId),
  ]);

  const exclude = new Set<string>([
    viewerId,
    ...(follows ?? []).map((f) => f.following_id),
    ...(blocks ?? []).map((b) => b.blocked_id),
  ]);

  const scores = new Map<string, number>();
  const genreIds = (myGenres ?? []).map((g) => g.genre_id);
  if (genreIds.length > 0) {
    const { data: overlaps } = await supabase
      .from("user_favorite_genres")
      .select("user_id")
      .in("genre_id", genreIds)
      .limit(1000);
    for (const row of overlaps ?? []) {
      if (!exclude.has(row.user_id)) scores.set(row.user_id, (scores.get(row.user_id) ?? 0) + 1);
    }
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit * 2);
  let people: FollowListEntry[] = [];

  if (ranked.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select(FIELDS)
      .in("id", ranked.map(([id]) => id))
      .not("onboarded_at", "is", null);
    const byId = new Map((data ?? []).map((p) => [p.id, p as FollowListEntry]));
    people = ranked.map(([id]) => byId.get(id)).filter((p): p is FollowListEntry => Boolean(p));
  }

  if (people.length < limit) {
    const taken = new Set([...exclude, ...people.map((p) => p.id)]);
    const { data } = await supabase
      .from("profiles")
      .select(FIELDS)
      .not("username", "is", null)
      .not("onboarded_at", "is", null)
      .order("followers_count", { ascending: false })
      .limit(limit + taken.size);
    for (const p of (data ?? []) as FollowListEntry[]) {
      if (people.length >= limit) break;
      if (!taken.has(p.id)) people.push(p);
    }
  }

  return people.slice(0, limit);
}

/** Which of `userIds` does the viewer follow? Used to render follow buttons in lists. */
export async function getViewerFollowingSet(viewerId: string | null, userIds: string[]) {
  if (!viewerId || userIds.length === 0) return new Set<string>();
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_follows")
    .select("following_id")
    .eq("follower_id", viewerId)
    .in("following_id", userIds);
  return new Set((data ?? []).map((row) => row.following_id));
}
