import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import { assertQuery } from "@/lib/supabase/errors";
import type { ReviewCard } from "@/types/domain";
import type { Enums } from "@/types/database";

export type AlbumDetail = {
  id: string;
  slug: string;
  title: string;
  artist_credit: string;
  album_type: string;
  secondary_types: string[];
  release_date: string | null;
  release_year: number | null;
  label: string | null;
  country: string | null;
  cover_url: string | null;
  track_count: number | null;
  duration_ms: number | null;
  artists: { id: string; slug: string; name: string; credited_name: string | null; join_phrase: string }[];
  tracks: { id: string; disc_number: number; position: number; number: string | null; title: string; duration_ms: number | null }[];
  genres: { slug: string; name: string; weight: number }[];
  musicbrainz_url: string | null;
};

/** Catalog data for an album. Public and slow-changing → cached. */
export async function getAlbumBySlug(slug: string): Promise<AlbumDetail | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(`album:${slug}`);

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("albums")
    .select(
      `id, slug, title, artist_credit, album_type, secondary_types, release_date, release_year,
       label, country, cover_url, track_count, duration_ms,
       album_artists(position, credited_name, join_phrase, artist:artists!inner(id, slug, name)),
       tracks(id, disc_number, position, number, title, duration_ms),
       album_genres(weight, genre:genres!inner(slug, name))`,
    )
    .eq("slug", slug)
    .maybeSingle();
  assertQuery(error, "album");
  if (!data) return null;

  const { data: source } = await supabase
    .from("catalog_sources")
    .select("url")
    .eq("entity_type", "album")
    .eq("entity_id", data.id)
    .eq("provider", "musicbrainz")
    .maybeSingle();

  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    artist_credit: data.artist_credit,
    album_type: data.album_type,
    secondary_types: data.secondary_types,
    release_date: data.release_date,
    release_year: data.release_year,
    label: data.label,
    country: data.country,
    cover_url: data.cover_url,
    track_count: data.track_count,
    duration_ms: data.duration_ms,
    artists: [...data.album_artists]
      .sort((a, b) => a.position - b.position)
      .map((a) => ({ ...a.artist, credited_name: a.credited_name, join_phrase: a.join_phrase })),
    tracks: [...data.tracks].sort((a, b) => a.disc_number - b.disc_number || a.position - b.position),
    genres: [...data.album_genres]
      .sort((a, b) => b.weight - a.weight)
      .map((g) => ({ ...g.genre, weight: g.weight })),
    musicbrainz_url: source?.url ?? null,
  };
}

export type AlbumStats = {
  ratings_count: number;
  average_rating: number | null;
  rating_histogram: number[];
  reviews_count: number;
  logs_count: number;
  favorites_count: number;
};

/** Community aggregates. Change often → short cache. */
export async function getAlbumStats(albumId: string): Promise<AlbumStats> {
  "use cache";
  cacheLife("minutes");
  cacheTag(`album-stats:${albumId}`, "album-stats");

  const supabase = createPublicClient();
  const { data } = await supabase
    .from("album_stats")
    .select("ratings_count, average_rating, rating_histogram, reviews_count, logs_count, favorites_count")
    .eq("album_id", albumId)
    .maybeSingle();

  return {
    ratings_count: data?.ratings_count ?? 0,
    average_rating: data?.average_rating === null || data?.average_rating === undefined ? null : Number(data.average_rating),
    rating_histogram: data?.rating_histogram ?? Array(10).fill(0),
    reviews_count: data?.reviews_count ?? 0,
    logs_count: data?.logs_count ?? 0,
    favorites_count: data?.favorites_count ?? 0,
  };
}

/** Reviews of an album the viewer is allowed to see (RLS), most liked first. */
export async function getAlbumReviews(albumId: string, limit = 6): Promise<ReviewCard[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select(
      `id, title, body, rating, contains_spoilers, likes_count, comments_count, created_at,
       author:profiles!reviews_user_id_fkey!inner(id, username, display_name, avatar_path),
       album:albums!inner(id, slug, title, artist_credit, release_year, cover_url, album_type)`,
    )
    .eq("album_id", albumId)
    .order("likes_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  assertQuery(error, "reviews");
  return (data ?? []) as unknown as ReviewCard[];
}

/** Albums that share genres with this one, best overlap first. */
export async function getRelatedAlbums(albumId: string, genreSlugs: string[], limit = 6) {
  "use cache";
  cacheLife("hours");
  cacheTag("albums");

  if (genreSlugs.length === 0) return [];
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("album_genres")
    .select("album_id, weight, genre:genres!inner(slug)")
    .in("genre.slug", genreSlugs.slice(0, 5))
    .neq("album_id", albumId)
    .limit(300);

  const scores = new Map<string, number>();
  for (const row of data ?? []) scores.set(row.album_id, (scores.get(row.album_id) ?? 0) + 1);
  const ids = [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
  if (ids.length === 0) return [];

  const { data: albums } = await supabase
    .from("albums")
    .select("id, slug, title, artist_credit, release_year, cover_url, album_type")
    .in("id", ids);
  const byId = new Map((albums ?? []).map((a) => [a.id, a]));
  return ids.map((id) => byId.get(id)).filter((a): a is NonNullable<typeof a> => Boolean(a));
}

export type ArtistDetail = {
  id: string;
  slug: string;
  name: string;
  sort_name: string | null;
  disambiguation: string | null;
  artist_type: string | null;
  country: string | null;
  begin_date: string | null;
  end_date: string | null;
  musicbrainz_id: string | null;
  albums: {
    id: string;
    slug: string;
    title: string;
    artist_credit: string;
    release_year: number | null;
    cover_url: string | null;
    album_type: Enums<"album_type">;
    average_rating: number | null;
    ratings_count: number;
  }[];
  fans: number;
};

/** Artist with the albums MUSICED already has (any credit position). */
export async function getArtistBySlug(slug: string): Promise<ArtistDetail | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(`artist:${slug}`, "albums");

  const supabase = createPublicClient();
  const { data: artist, error } = await supabase
    .from("artists")
    .select("id, slug, name, sort_name, disambiguation, artist_type, country, begin_date, end_date")
    .eq("slug", slug)
    .maybeSingle();
  assertQuery(error, "artist");
  if (!artist) return null;

  const [{ data: credits }, { data: source }, { count: fans }] = await Promise.all([
    supabase
      .from("album_artists")
      .select(
        `album:albums!inner(id, slug, title, artist_credit, release_year, cover_url, album_type,
          album_stats(average_rating, ratings_count))`,
      )
      .eq("artist_id", artist.id)
      .limit(300),
    supabase
      .from("catalog_sources")
      .select("external_id")
      .eq("entity_type", "artist")
      .eq("entity_id", artist.id)
      .eq("provider", "musicbrainz")
      .maybeSingle(),
    supabase.from("user_favorite_artists").select("user_id", { head: true, count: "exact" }).eq("artist_id", artist.id),
  ]);

  type Row = {
    album: Omit<ArtistDetail["albums"][number], "average_rating" | "ratings_count"> & {
      album_stats: { average_rating: number | null; ratings_count: number } | null;
    };
  };
  const albums = ((credits ?? []) as unknown as Row[])
    .map(({ album }) => {
      const { album_stats, ...rest } = album;
      return {
        ...rest,
        average_rating: album_stats?.average_rating == null ? null : Number(album_stats.average_rating),
        ratings_count: album_stats?.ratings_count ?? 0,
      };
    })
    .sort((a, b) => (a.release_year ?? 9999) - (b.release_year ?? 9999));

  return { ...artist, musicbrainz_id: source?.external_id ?? null, albums, fans: fans ?? 0 };
}
