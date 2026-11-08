"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/session";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import {
  favoriteGenresSchema,
  onboardingProfileSchema,
  type OnboardingProfileInput,
} from "@/lib/validation/profile";
import { getSuggestedListeners } from "@/features/social/queries";
import { browseAlbums } from "@/features/discovery/queries";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  CatalogImportError,
  findArtistByExternalId,
  getProviderDiscography,
  importAlbum,
  importArtist,
  searchArtistsCatalog,
} from "@/features/catalog/service";
import { setRating } from "@/features/listening/actions";

const SIGNED_OUT = "Your session has ended. Please sign in again.";

export async function saveOnboardingProfile(input: OnboardingProfileInput): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail(SIGNED_OUT);

  const parsed = onboardingProfileSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      username: parsed.data.username,
      display_name: parsed.data.displayName ?? null,
      bio: parsed.data.bio ?? null,
    })
    .eq("id", viewer.id);

  if (error) {
    if (error.code === "23505") {
      return fail("That username is taken.", { username: "That username is taken" });
    }
    if (error.code === "23514") {
      return fail("That username isn't available.", { username: "That username isn't available" });
    }
    console.error("[onboarding] profile save failed", error.code, error.message);
    return fail("We couldn't save your profile. Please try again.");
  }

  return ok(undefined);
}

/** Replaces the viewer's favorite genres with the given set (by slug). */
export async function saveFavoriteGenres(genreSlugs: string[]): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail(SIGNED_OUT);

  const parsed = favoriteGenresSchema.safeParse({ genreSlugs: [...new Set(genreSlugs)] });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();

  // Resolve slugs to current ids server-side (uncached).
  let wantedIds: string[] = [];
  if (parsed.data.genreSlugs.length > 0) {
    const { data: rows, error: lookupError } = await supabase
      .from("genres")
      .select("id, slug")
      .in("slug", parsed.data.genreSlugs);
    if (lookupError) return fail("We couldn't save your genres. Please try again.");
    if ((rows ?? []).length !== parsed.data.genreSlugs.length) {
      return fail("One of those genres isn't available any more. Refresh the page and try again.");
    }
    wantedIds = (rows ?? []).map((row) => row.id);
  }

  const { data: current, error: readError } = await supabase
    .from("user_favorite_genres")
    .select("genre_id")
    .eq("user_id", viewer.id);
  if (readError) return fail("We couldn't save your genres. Please try again.");

  const wanted = new Set(wantedIds);
  const existing = new Set((current ?? []).map((row) => row.genre_id));
  const toRemove = [...existing].filter((id) => !wanted.has(id));
  const toAdd = [...wanted].filter((id) => !existing.has(id));

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("user_favorite_genres")
      .delete()
      .eq("user_id", viewer.id)
      .in("genre_id", toRemove);
    if (error) return fail("We couldn't save your genres. Please try again.");
  }

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from("user_favorite_genres")
      .insert(toAdd.map((genre_id) => ({ user_id: viewer.id, genre_id })));
    if (error) {
      if (error.code === "23503") return fail("One of those genres no longer exists.");
      return fail("We couldn't save your genres. Please try again.");
    }
  }

  return ok(undefined);
}

export async function completeOnboarding(): Promise<ActionResult<never>> {
  const viewer = await getViewer();
  if (!viewer) return fail(SIGNED_OUT);

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, onboarded_at")
    .eq("id", viewer.id)
    .single();

  if (!profile?.username) return fail("Choose a username before continuing.");

  if (!profile.onboarded_at) {
    const { error } = await supabase
      .from("profiles")
      .update({ onboarded_at: new Date().toISOString() })
      .eq("id", viewer.id);
    if (error) return fail("We couldn't finish setting up your account. Please try again.");
  }

  revalidatePath("/", "layout");
  redirect("/?welcome=1");
}

/** Listener suggestions, recomputed after the viewer picks genres. */
export async function getOnboardingSuggestions(): Promise<
  ActionResult<Awaited<ReturnType<typeof getSuggestedListeners>>>
> {
  const viewer = await getViewer();
  if (!viewer) return fail(SIGNED_OUT);
  try {
    return ok(await getSuggestedListeners(viewer.id, 8));
  } catch {
    return fail("We couldn't load suggestions right now.");
  }
}

export type ArtistPick = { kind: "local"; id: string; name: string } | { kind: "remote"; externalId: string; name: string };

/** Artist search for the onboarding picker (MUSICED first, then MusicBrainz). */
export async function searchArtistsAction(query: string) {
  const viewer = await getViewer();
  if (!viewer) return fail(SIGNED_OUT);
  const q = query.trim();
  if (q.length < 2) return ok({ local: [], remote: [] } as Awaited<ReturnType<typeof searchArtistsCatalog>>);
  const limit = await checkRateLimit("catalogSearch", viewer.id);
  if (!limit.allowed) return fail("You're searching very quickly. Give it a second.");
  return ok(await searchArtistsCatalog(q, 8));
}

/** Replace the viewer's favourite artists. MusicBrainz picks are imported first. */
export async function saveFavoriteArtists(picks: ArtistPick[]): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail(SIGNED_OUT);
  if (picks.length > 12) return fail("Pick up to 12 artists.");

  const ids: string[] = [];
  for (const pick of picks) {
    if (pick.kind === "local") {
      if (/^[0-9a-f-]{36}$/i.test(pick.id)) ids.push(pick.id);
      continue;
    }
    if (!/^[0-9a-f-]{36}$/i.test(pick.externalId)) continue;
    const limit = await checkRateLimit("catalogImport", viewer.id);
    if (!limit.allowed) return fail("Too many new artists at once. Try again in a bit.");
    try {
      const existing = await findArtistByExternalId(pick.externalId);
      ids.push(existing?.id ?? (await importArtist(pick.externalId)).id);
    } catch (err) {
      return fail(err instanceof CatalogImportError ? err.message : `We couldn't add ${pick.name}.`);
    }
  }

  const supabase = await createClient();
  const { error: delError } = await supabase.from("user_favorite_artists").delete().eq("user_id", viewer.id);
  if (delError) return fail("We couldn't save your artists.");
  if (ids.length) {
    const unique = [...new Set(ids)];
    const { error } = await supabase
      .from("user_favorite_artists")
      .insert(unique.map((artist_id, position) => ({ user_id: viewer.id, artist_id, position })));
    if (error) return fail("We couldn't save your artists.");
  }
  return ok(undefined);
}

export type OnboardingAlbum = {
  /** Local album id when it's already on MUSICED; otherwise null and `externalId` is set. */
  albumId: string | null;
  externalId: string | null;
  title: string;
  artist_credit: string;
  release_year: number | null;
  cover_url: string | null;
  /** Why it's suggested, shown under the album. */
  reason: string;
};

/**
 * Albums to rate during onboarding, most relevant first:
 *   1. by the viewer's favourite artists (catalog first, then their MusicBrainz
 *      discography — imported only when actually rated),
 *   2. popular/top albums in the viewer's favourite genres.
 * Never pads with unrelated albums: an empty result means "skip this step".
 */
export async function getOnboardingAlbums(): Promise<ActionResult<OnboardingAlbum[]>> {
  const viewer = await getViewer();
  if (!viewer) return fail(SIGNED_OUT);
  const LIMIT = 12;
  const out: OnboardingAlbum[] = [];
  const seenLocal = new Set<string>();
  const seenTitles = new Set<string>();
  const key = (title: string, artist: string) => `${title}|${artist}`.toLowerCase();
  const push = (a: OnboardingAlbum) => {
    const k = key(a.title, a.artist_credit);
    if (seenTitles.has(k) || (a.albumId && seenLocal.has(a.albumId)) || out.length >= LIMIT) return;
    seenTitles.add(k);
    if (a.albumId) seenLocal.add(a.albumId);
    out.push(a);
  };

  try {
    const supabase = await createClient();
    const [{ data: favArtists }, { data: genres }] = await Promise.all([
      supabase
        .from("user_favorite_artists")
        .select("position, artist:artists!inner(id, name)")
        .eq("user_id", viewer.id)
        .order("position")
        .limit(4),
      supabase.from("user_favorite_genres").select("genre:genres!inner(slug, name)").eq("user_id", viewer.id),
    ]);
    const artists = (favArtists ?? []).map((row) => row.artist);

    // 1a. Their albums already on MUSICED.
    if (artists.length) {
      const { data: credits } = await supabase
        .from("album_artists")
        .select("artist_id, album:albums!inner(id, title, artist_credit, release_year, cover_url)")
        .in("artist_id", artists.map((a) => a.id))
        .limit(60);
      for (const row of credits ?? []) {
        const name = artists.find((a) => a.id === row.artist_id)?.name ?? "an artist you like";
        push({ albumId: row.album.id, externalId: null, ...row.album, reason: `Because you like ${name}` });
      }
    }

    // 1b. Their discography from MusicBrainz (cached), up to 4 albums per artist.
    if (artists.length && out.length < LIMIT) {
      const { data: sources } = await supabase
        .from("catalog_sources")
        .select("entity_id, external_id")
        .eq("provider", "musicbrainz")
        .eq("entity_type", "artist")
        .in("entity_id", artists.map((a) => a.id));
      const discographies = await Promise.all(
        (sources ?? []).map(async (src) => ({
          name: artists.find((a) => a.id === src.entity_id)?.name ?? "",
          hits: await getProviderDiscography(src.external_id).catch(() => []),
        })),
      );
      for (const { name, hits } of discographies) {
        // Most recent full albums first: the ones people are likeliest to know.
        const picks = [...hits]
          .sort((a, b) => Number(b.albumType === "album") - Number(a.albumType === "album") || (b.releaseYear ?? 0) - (a.releaseYear ?? 0))
          .slice(0, 4);
        for (const hit of picks) {
          push({
            albumId: null,
            externalId: hit.externalId,
            title: hit.title,
            artist_credit: hit.artistCredit,
            release_year: hit.releaseYear,
            cover_url: hit.coverUrl,
            reason: `Because you like ${name}`,
          });
        }
      }
    }

    // 2. Popular albums in their genres (genre-matched only — no unrelated filler).
    const genreRows = (genres ?? []).map((g) => g.genre).slice(0, 3);
    for (const genre of genreRows) {
      if (out.length >= LIMIT) break;
      for (const sort of ["popular", "top"] as const) {
        for (const a of await browseAlbums({ sort, genre: genre.slug, pageSize: 8 })) {
          push({ albumId: a.id, externalId: null, title: a.title, artist_credit: a.artist_credit, release_year: a.release_year, cover_url: a.cover_url, reason: genre.name });
        }
      }
    }

    return ok(out);
  } catch (err) {
    console.error("[onboarding] album suggestions failed:", (err as Error).message);
    return fail("We couldn't load albums right now.");
  }
}

/** Rate a MusicBrainz suggestion: import it (idempotent), then save the rating. */
export async function rateSuggestedAlbum(externalId: string, rating: number | null): Promise<ActionResult<{ albumId: string }>> {
  const viewer = await getViewer();
  if (!viewer) return fail(SIGNED_OUT);
  if (!/^[0-9a-f-]{36}$/i.test(externalId)) return fail("Unknown album.");
  const limit = await checkRateLimit("catalogImport", viewer.id);
  if (!limit.allowed) return fail("You've added a lot of albums recently. Try again in a bit.");
  try {
    const album = await importAlbum(externalId);
    const result = await setRating(album.id, rating);
    return result.ok ? ok({ albumId: album.id }) : result;
  } catch (err) {
    return fail(err instanceof CatalogImportError ? err.message : "We couldn't save that rating.");
  }
}
