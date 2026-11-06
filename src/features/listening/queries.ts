import "server-only";

import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertQuery } from "@/lib/supabase/errors";
import { getViewer } from "@/lib/auth/session";
import type { AlbumSummary, ReviewCard, Visibility } from "@/types/domain";

const ALBUM_FIELDS = "id, slug, title, artist_credit, release_year, cover_url, album_type";

export type ViewerReview = {
  id: string;
  title: string | null;
  body: string;
  rating: number | null;
  contains_spoilers: boolean;
  visibility: Visibility;
};

export type ViewerAlbumState = {
  signedIn: boolean;
  rating: number | null;
  review: ViewerReview | null;
  favorite: boolean;
  logCount: number;
  lastListenedOn: string | null;
  defaults: { logVisibility: Visibility; reviewVisibility: Visibility };
};

/** Everything the album page needs to know about the viewer's history with an album. */
export async function getViewerAlbumState(albumId: string): Promise<ViewerAlbumState> {
  const viewer = await getViewer();
  const empty: ViewerAlbumState = {
    signedIn: false,
    rating: null,
    review: null,
    favorite: false,
    logCount: 0,
    lastListenedOn: null,
    defaults: { logVisibility: "public", reviewVisibility: "public" },
  };
  if (!viewer) return empty;

  const supabase = await createClient();
  const [rating, review, favorite, logs, prefs] = await Promise.all([
    supabase.from("album_ratings").select("rating").eq("user_id", viewer.id).eq("album_id", albumId).maybeSingle(),
    supabase
      .from("reviews")
      .select("id, title, body, rating, contains_spoilers, visibility")
      .eq("user_id", viewer.id)
      .eq("album_id", albumId)
      .maybeSingle(),
    supabase.from("favorite_albums").select("album_id").eq("user_id", viewer.id).eq("album_id", albumId).maybeSingle(),
    supabase
      .from("listening_logs")
      .select("listened_on", { count: "exact" })
      .eq("user_id", viewer.id)
      .eq("album_id", albumId)
      .order("listened_on", { ascending: false })
      .limit(1),
    supabase
      .from("user_preferences")
      .select("default_log_visibility, default_review_visibility")
      .eq("user_id", viewer.id)
      .maybeSingle(),
  ]);

  return {
    signedIn: true,
    rating: rating.data ? Number(rating.data.rating) : null,
    review: review.data
      ? { ...review.data, rating: review.data.rating === null ? null : Number(review.data.rating) }
      : null,
    favorite: Boolean(favorite.data),
    logCount: logs.count ?? 0,
    lastListenedOn: logs.data?.[0]?.listened_on ?? null,
    defaults: {
      logVisibility: prefs.data?.default_log_visibility ?? "public",
      reviewVisibility: prefs.data?.default_review_visibility ?? "public",
    },
  };
}

export type DiaryEntry = {
  id: string;
  listened_on: string;
  rating: number | null;
  note: string | null;
  is_relisten: boolean;
  is_favorite: boolean;
  visibility: Visibility;
  created_at: string;
  album: AlbumSummary;
};

/** A user's diary, newest first, as far as the viewer is allowed to see. */
export async function getDiary(userId: string, { year, page = 1, pageSize = 50 }: { year?: number; page?: number; pageSize?: number } = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("listening_logs")
    .select(`id, listened_on, rating, note, is_relisten, is_favorite, visibility, created_at, album:albums!inner(${ALBUM_FIELDS})`, {
      count: "exact",
    })
    .eq("user_id", userId);
  if (year) query = query.gte("listened_on", `${year}-01-01`).lte("listened_on", `${year}-12-31`);
  const from = (page - 1) * pageSize;
  const { data, error, count } = await query
    .order("listened_on", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  assertQuery(error, "diary");
  return {
    entries: ((data ?? []) as unknown as DiaryEntry[]).map((e) => ({ ...e, rating: e.rating === null ? null : Number(e.rating) })),
    total: count ?? 0,
    page,
    pageSize,
  };
}

/** Years in which the user has (visible) diary entries, newest first. */
export async function getDiaryYears(userId: string): Promise<number[]> {
  const supabase = await createClient();
  const [{ data: newest }, { data: oldest }] = await Promise.all([
    supabase.from("listening_logs").select("listened_on").eq("user_id", userId).order("listened_on", { ascending: false }).limit(1),
    supabase.from("listening_logs").select("listened_on").eq("user_id", userId).order("listened_on", { ascending: true }).limit(1),
  ]);
  if (!newest?.[0] || !oldest?.[0]) return [];
  const last = Number(newest[0].listened_on.slice(0, 4));
  const first = Number(oldest[0].listened_on.slice(0, 4));
  return Array.from({ length: last - first + 1 }, (_, i) => last - i);
}

export async function getUserReviews(userId: string, page = 1, pageSize = 20) {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const { data, error, count } = await supabase
    .from("reviews")
    .select(
      `id, title, body, rating, contains_spoilers, likes_count, comments_count, created_at,
       author:profiles!reviews_user_id_fkey!inner(id, username, display_name, avatar_path),
       album:albums!inner(${ALBUM_FIELDS})`,
      { count: "exact" },
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  assertQuery(error, "reviews");
  return { reviews: (data ?? []) as unknown as ReviewCard[], total: count ?? 0, page, pageSize };
}

/** Listening activity per month for the last 12 months (for the profile chart). */
export async function getMonthlyListening(userId: string) {
  await connection(); // the 12-month window depends on the clock
  const supabase = await createClient();
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - 11, 1);
  const sinceIso = since.toISOString().slice(0, 10);
  const { data } = await supabase
    .from("listening_logs")
    .select("listened_on")
    .eq("user_id", userId)
    .gte("listened_on", sinceIso)
    .limit(5000);

  const buckets = new Map<string, number>();
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth() + i, 1));
    buckets.set(d.toISOString().slice(0, 7), 0);
  }
  for (const row of data ?? []) {
    const key = row.listened_on.slice(0, 7);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([month, count]) => ({ month, count }));
}

/** All of the viewer's favourite albums, pinned (by position) first. */
export async function getMyFavorites(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("favorite_albums")
    .select(`position, created_at, album:albums!inner(${ALBUM_FIELDS})`)
    .eq("user_id", userId)
    .order("position", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(200);
  assertQuery(error, "favourites");
  return (data ?? []).map((row) => ({ position: row.position, album: row.album as unknown as AlbumSummary }));
}
