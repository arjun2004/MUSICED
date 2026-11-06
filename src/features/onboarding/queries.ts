import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import { assertQuery } from "@/lib/supabase/errors";

export type GenreOption = { id: string; slug: string; name: string };

/** Curated genres offered during onboarding. Reference data → cached. */
export async function getFeaturedGenres(): Promise<GenreOption[]> {
  "use cache";
  cacheLife("days");
  cacheTag("genres");

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("genres")
    .select("id, slug, name")
    .eq("is_featured", true)
    .order("sort_order", { ascending: true });
  assertQuery(error, `genres`);
  return data ?? [];
}

/** The user's favorite genres as stable slugs. */
export async function getMyGenreSlugs(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_favorite_genres")
    .select("genre:genres!inner(slug)")
    .eq("user_id", userId);
  assertQuery(error, "favorite genres");
  return (data ?? []).map((row) => row.genre.slug);
}

export async function getMyFavoriteArtists(userId: string): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_favorite_artists")
    .select("position, artist:artists!inner(id, name)")
    .eq("user_id", userId)
    .order("position");
  return (data ?? []).map((row) => row.artist);
}
