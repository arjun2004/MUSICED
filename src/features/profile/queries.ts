import "server-only";

import { cache } from "react";
import { connection } from "next/server";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/session";
import type { AlbumSummary, ProfileSummary, ReviewCard } from "@/types/domain";
import { assertQuery } from "@/lib/supabase/errors";

const ALBUM_FIELDS = "id, slug, title, artist_credit, release_year, cover_url, album_type";

export type PublicProfile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_path: string | null;
  location: string | null;
  website: string | null;
  followers_count: number;
  following_count: number;
  created_at: string;
};

export type ProfileRelationship = {
  isSelf: boolean;
  isFollowing: boolean;
  followsViewer: boolean;
  hasBlocked: boolean;
  isSignedIn: boolean;
};

export const getProfileByUsername = cache(async (username: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, bio, avatar_path, location, website, followers_count, following_count, created_at",
    )
    .eq("username", username.toLowerCase())
    .maybeSingle();
  assertQuery(error, `profile`);
  return data as PublicProfile | null;
});

export async function getRelationship(profileId: string): Promise<ProfileRelationship> {
  const viewer = await getViewer();
  if (!viewer) {
    return { isSelf: false, isFollowing: false, followsViewer: false, hasBlocked: false, isSignedIn: false };
  }
  if (viewer.id === profileId) {
    return { isSelf: true, isFollowing: false, followsViewer: false, hasBlocked: false, isSignedIn: true };
  }

  const supabase = await createClient();
  const [following, followedBy, blocked] = await Promise.all([
    supabase
      .from("user_follows")
      .select("follower_id", { head: true, count: "exact" })
      .eq("follower_id", viewer.id)
      .eq("following_id", profileId),
    supabase
      .from("user_follows")
      .select("follower_id", { head: true, count: "exact" })
      .eq("follower_id", profileId)
      .eq("following_id", viewer.id),
    supabase
      .from("user_blocks")
      .select("blocker_id", { head: true, count: "exact" })
      .eq("blocker_id", viewer.id)
      .eq("blocked_id", profileId),
  ]);

  return {
    isSelf: false,
    isFollowing: (following.count ?? 0) > 0,
    followsViewer: (followedBy.count ?? 0) > 0,
    hasBlocked: (blocked.count ?? 0) > 0,
    isSignedIn: true,
  };
}

export type ProfileStats = {
  ratings: number;
  logs: number;
  logsThisYear: number;
  reviews: number;
  lists: number;
  histogram: number[]; // 10 buckets, 0.5..5.0
};

/**
 * Counts are computed through RLS, so a visitor only counts what they are
 * allowed to see (private diary entries are excluded for others).
 */
export async function getProfileStats(profileId: string): Promise<ProfileStats> {
  // Request-time: "this year" depends on the clock (not prerenderable).
  await connection();
  const supabase = await createClient();
  const yearStart = `${new Date().getUTCFullYear()}-01-01`;

  const [ratings, logs, logsThisYear, reviews, lists, ratingValues] = await Promise.all([
    supabase.from("album_ratings").select("id", { head: true, count: "exact" }).eq("user_id", profileId),
    supabase.from("listening_logs").select("id", { head: true, count: "exact" }).eq("user_id", profileId),
    supabase
      .from("listening_logs")
      .select("id", { head: true, count: "exact" })
      .eq("user_id", profileId)
      .gte("listened_on", yearStart),
    supabase.from("reviews").select("id", { head: true, count: "exact" }).eq("user_id", profileId),
    supabase.from("user_lists").select("id", { head: true, count: "exact" }).eq("user_id", profileId),
    supabase.from("album_ratings").select("rating").eq("user_id", profileId).limit(10000),
  ]);

  const histogram = Array.from({ length: 10 }, () => 0);
  for (const row of ratingValues.data ?? []) {
    const index = Math.round(Number(row.rating) * 2) - 1;
    if (index >= 0 && index < 10) histogram[index] += 1;
  }

  return {
    ratings: ratings.count ?? 0,
    logs: logs.count ?? 0,
    logsThisYear: logsThisYear.count ?? 0,
    reviews: reviews.count ?? 0,
    lists: lists.count ?? 0,
    histogram,
  };
}

export async function getFavoriteGenres(profileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_favorite_genres")
    .select("genre:genres!inner(id, slug, name, sort_order)")
    .eq("user_id", profileId);
  assertQuery(error, `genres`);
  return (data ?? [])
    .map((row) => row.genre)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export async function getFavoriteAlbums(profileId: string): Promise<AlbumSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("favorite_albums")
    .select(`position, album:albums!inner(${ALBUM_FIELDS})`)
    .eq("user_id", profileId)
    .not("position", "is", null)
    .order("position", { ascending: true })
    .limit(4);
  assertQuery(error, `favorites`);
  return (data ?? []).map((row) => row.album as AlbumSummary);
}

export type DiaryPreview = {
  id: string;
  listened_on: string;
  rating: number | null;
  is_relisten: boolean;
  is_favorite: boolean;
  album: AlbumSummary;
};

export async function getRecentDiary(profileId: string, limit = 8): Promise<DiaryPreview[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listening_logs")
    .select(`id, listened_on, rating, is_relisten, is_favorite, album:albums!inner(${ALBUM_FIELDS})`)
    .eq("user_id", profileId)
    .order("listened_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  assertQuery(error, `diary`);
  return (data ?? []) as unknown as DiaryPreview[];
}

export async function getProfileReviews(profileId: string, limit = 3): Promise<ReviewCard[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select(
      `id, title, body, rating, contains_spoilers, likes_count, comments_count, created_at,
       author:profiles!reviews_user_id_fkey!inner(id, username, display_name, avatar_path),
       album:albums!inner(${ALBUM_FIELDS})`,
    )
    .eq("user_id", profileId)
    .order("created_at", { ascending: false })
    .limit(limit);
  assertQuery(error, `reviews`);
  return (data ?? []) as unknown as ReviewCard[];
}

export type FollowListEntry = ProfileSummary & { bio: string | null; followers_count: number };

export async function getFollowList(
  profileId: string,
  direction: "followers" | "following",
  page = 1,
  pageSize = 30,
) {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const fields = "id, username, display_name, avatar_path, bio, followers_count";

  const query =
    direction === "followers"
      ? supabase
          .from("user_follows")
          .select(`created_at, person:profiles!user_follows_follower_id_fkey!inner(${fields})`, {
            count: "exact",
          })
          .eq("following_id", profileId)
      : supabase
          .from("user_follows")
          .select(`created_at, person:profiles!user_follows_following_id_fkey!inner(${fields})`, {
            count: "exact",
          })
          .eq("follower_id", profileId);

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  assertQuery(error, `${direction}`);

  return {
    people: (data ?? []).map((row) => row.person as FollowListEntry),
    total: count ?? 0,
    page,
    pageSize,
  };
}

/**
 * Minimal public profile data for <head> metadata. Cookie-less and cached so
 * metadata never blocks on the session.
 */
export async function getProfileMeta(username: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`profile:${username}`);

  const supabase = createPublicClient();
  const { data } = await supabase
    .from("profiles")
    .select("username, display_name, bio")
    .eq("username", username.toLowerCase())
    .maybeSingle();
  return data;
}

export async function getFavoriteArtists(profileId: string): Promise<{ id: string; slug: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_favorite_artists")
    .select("position, artist:artists!inner(id, slug, name)")
    .eq("user_id", profileId)
    .order("position")
    .limit(12);
  return (data ?? []).map((row) => row.artist);
}
