import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import type { AlbumSummary, AlbumWithStats, FeedItem, ProfileSummary, ReviewCard } from "@/types/domain";
import { assertQuery, isAbortError } from "@/lib/supabase/errors";
import { collapseFeed } from "./collapse-feed";

const ALBUM_FIELDS = "id, slug, title, artist_credit, release_year, cover_url, album_type";
const PROFILE_FIELDS = "id, username, display_name, avatar_path";

/** Minimum ratings before an album can appear in "highest rated". */
export const MIN_RATINGS_FOR_RANKING = 3;

type StatsRow = {
  average_rating: number | null;
  ratings_count: number;
  album: AlbumSummary | null;
};

function toAlbumWithStats(rows: StatsRow[] | null): AlbumWithStats[] {
  return (rows ?? [])
    .filter((row): row is StatsRow & { album: AlbumSummary } => row.album !== null)
    .map((row) => ({
      ...row.album,
      average_rating: row.average_rating === null ? null : Number(row.average_rating),
      ratings_count: row.ratings_count,
    }));
}

/**
 * Highest-rated albums (Bayesian ranking will replace the raw average in the
 * charts phase). Public aggregate → cached for everyone.
 */
export async function getHighestRatedAlbums(limit = 12): Promise<AlbumWithStats[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("album-stats");

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("album_stats")
    .select(`average_rating, ratings_count, album:albums!inner(${ALBUM_FIELDS})`)
    .gte("ratings_count", MIN_RATINGS_FOR_RANKING)
    .order("average_rating", { ascending: false, nullsFirst: false })
    .order("ratings_count", { ascending: false })
    .limit(limit);

  // Public rails are prerendered; hide the rail rather than fail the page/build.
  if (error) {
    if (!isAbortError(error)) console.error("[discovery] highest rated albums unavailable:", error.message);
    return [];
  }
  return toAlbumWithStats(data as StatsRow[]);
}

/** Albums with the most recent community activity. */
export async function getTrendingAlbums(limit = 12): Promise<AlbumWithStats[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("album-stats");

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("album_stats")
    .select(`average_rating, ratings_count, album:albums!inner(${ALBUM_FIELDS})`)
    .not("last_activity_at", "is", null)
    .order("last_activity_at", { ascending: false })
    .limit(limit);

  // Public rails are prerendered; hide the rail rather than fail the page/build.
  if (error) {
    if (!isAbortError(error)) console.error("[discovery] trending albums unavailable:", error.message);
    return [];
  }
  return toAlbumWithStats(data as StatsRow[]);
}

/** Cover art for the hero mosaic: only albums with artwork actually available. */
export async function getHeroCovers(limit = 15): Promise<AlbumSummary[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("albums");

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("albums")
    .select(ALBUM_FIELDS)
    .eq("cover_status", "available")
    .not("cover_url", "is", null)
    .order("updated_at", { ascending: false })
    .limit(limit);

  // Decorative only (and may run during prerender): degrade to the
  // typographic fallback instead of failing the page or the build.
  if (error) {
    if (!isAbortError(error)) console.error("[discovery] hero covers unavailable:", error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Recent public reviews. Viewer-dependent (blocked authors are hidden by RLS),
 * so this uses the session client and is not shared-cached.
 */
export async function getRecentReviews(limit = 6): Promise<ReviewCard[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select(
      `id, title, body, rating, contains_spoilers, likes_count, comments_count, created_at,
       author:profiles!reviews_user_id_fkey!inner(${PROFILE_FIELDS}),
       album:albums!inner(${ALBUM_FIELDS})`,
    )
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(limit);

  assertQuery(error, `reviews`);
  return (data ?? []) as unknown as ReviewCard[];
}

/** Listeners with recent public activity, most recent first. */
export async function getRecentlyActiveListeners(limit = 8): Promise<ProfileSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select(`created_at, actor:profiles!activities_actor_id_fkey!inner(${PROFILE_FIELDS})`)
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(80);

  assertQuery(error, `listeners`);
  const seen = new Map<string, ProfileSummary>();
  for (const row of (data ?? []) as unknown as { actor: ProfileSummary }[]) {
    if (!seen.has(row.actor.id)) seen.set(row.actor.id, row.actor);
    if (seen.size >= limit) break;
  }
  return [...seen.values()];
}

const FEED_SELECT = `id, type, created_at, rating,
  actor:profiles!activities_actor_id_fkey!inner(${PROFILE_FIELDS}),
  subject:profiles!activities_subject_user_id_fkey(${PROFILE_FIELDS}),
  album:albums(${ALBUM_FIELDS}),
  review:reviews(id, title, body, contains_spoilers),
  list:user_lists(id, title, items_count)`;

/**
 * Activity from people the viewer follows (plus their own). Visibility and
 * blocks are enforced by RLS on `activities`, so followers-only and private
 * entries never leak.
 */
export async function getFollowingFeed(viewerId: string, limit = 30): Promise<FeedItem[]> {
  const supabase = await createClient();
  const { data: follows, error: followsError } = await supabase
    .from("user_follows")
    .select("following_id")
    .eq("follower_id", viewerId)
    .limit(1000);
  assertQuery(followsError, `feed`);

  const actorIds = [viewerId, ...(follows ?? []).map((f) => f.following_id)];
  const { data, error } = await supabase
    .from("activities")
    .select(FEED_SELECT)
    .in("actor_id", actorIds)
    .order("created_at", { ascending: false })
    // Over-fetch: related actions are merged into one entry below.
    .limit(limit * 3);

  assertQuery(error, `feed`);
  return collapseFeed((data ?? []) as unknown as FeedItem[]).slice(0, limit);
}

/** Public community activity for signed-out visitors and new accounts. */
export async function getCommunityFeed(limit = 20): Promise<FeedItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select(FEED_SELECT)
    .eq("visibility", "public")
    .neq("type", "followed")
    .order("created_at", { ascending: false })
    .limit(limit * 3);

  assertQuery(error, `activity`);
  return collapseFeed((data ?? []) as unknown as FeedItem[]).slice(0, limit);
}

export type BrowseSort = "top" | "popular" | "trending" | "new" | "recent";
export type BrowseFilters = {
  sort: BrowseSort;
  genre?: string;
  decade?: number;
  year?: number;
  country?: string;
  page?: number;
  pageSize?: number;
};

/** Filterable, ranked album browse for Explore and Charts. Public → cached briefly. */
export async function browseAlbums(filters: BrowseFilters): Promise<AlbumWithStats[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("album-stats", "albums");

  const pageSize = filters.pageSize ?? 36;
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("browse_albums", {
    p_sort: filters.sort,
    p_genre: filters.genre ?? undefined,
    p_decade: filters.decade ?? undefined,
    p_year: filters.year ?? undefined,
    p_country: filters.country ?? undefined,
    p_min_ratings: 1,
    p_limit: pageSize,
    p_offset: ((filters.page ?? 1) - 1) * pageSize,
  });
  // Rails using this are prerendered: hide them rather than fail the page/build.
  if (error) {
    if (!isAbortError(error)) console.error("[discovery] browse unavailable:", error.message);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    artist_credit: row.artist_credit,
    release_year: row.release_year,
    cover_url: row.cover_url,
    album_type: row.album_type,
    average_rating: row.average_rating === null ? null : Number(row.average_rating),
    ratings_count: row.ratings_count,
  }));
}

export type ExploreFacets = {
  genres: { slug: string; name: string; albums: number }[];
  decades: { decade: number; albums: number }[];
  countries: { country: string; albums: number }[];
  total: number;
};

export async function getExploreFacets(): Promise<ExploreFacets> {
  "use cache";
  cacheLife("hours");
  cacheTag("albums");
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("explore_facets");
  if (error) {
    if (!isAbortError(error)) console.error("[discovery] facets unavailable:", error.message);
    return { genres: [], decades: [], countries: [], total: 0 };
  }
  return data as unknown as ExploreFacets;
}

/** Most-liked public lists, for the homepage. */
export async function getFeaturedReviews(limit = 3): Promise<ReviewCard[]> {
  await connection(); // the 90-day window depends on the clock
  const supabase = await createClient();
  const since = new Date(Date.now() - 90 * 24 * 3600_000).toISOString();
  const { data, error } = await supabase
    .from("reviews")
    .select(
      `id, title, body, rating, contains_spoilers, likes_count, comments_count, created_at,
       author:profiles!reviews_user_id_fkey!inner(${PROFILE_FIELDS}),
       album:albums!inner(${ALBUM_FIELDS})`,
    )
    .eq("visibility", "public")
    .gte("created_at", since)
    .gt("likes_count", 0)
    .order("likes_count", { ascending: false })
    .limit(limit);
  assertQuery(error, "featured reviews");
  return (data ?? []) as unknown as ReviewCard[];
}

/**
 * Albums for a signed-in listener: well-rated albums in their favourite genres
 * that they haven't rated or logged yet.
 */
export async function getRecommendedAlbums(viewerId: string, limit = 6): Promise<AlbumWithStats[]> {
  const supabase = await createClient();
  const [{ data: genres }, { data: rated }, { data: logged }] = await Promise.all([
    supabase.from("user_favorite_genres").select("genre:genres!inner(slug)").eq("user_id", viewerId),
    supabase.from("album_ratings").select("album_id").eq("user_id", viewerId).limit(2000),
    supabase.from("listening_logs").select("album_id").eq("user_id", viewerId).limit(2000),
  ]);
  const seen = new Set([...(rated ?? []), ...(logged ?? [])].map((r) => r.album_id));
  const slugs = (genres ?? []).map((g) => g.genre.slug).slice(0, 4);

  const pools = await Promise.all(
    (slugs.length ? slugs : [undefined]).map((genre) => browseAlbums({ sort: "top", genre, pageSize: 24 })),
  );
  const out: AlbumWithStats[] = [];
  const taken = new Set<string>();
  // Round-robin across genres so one genre doesn't dominate.
  for (let i = 0; out.length < limit && i < 24; i++) {
    for (const pool of pools) {
      const album = pool[i];
      if (album && !seen.has(album.id) && !taken.has(album.id)) {
        out.push(album);
        taken.add(album.id);
        if (out.length >= limit) break;
      }
    }
  }
  return out;
}
