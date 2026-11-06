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
  importArtist,
  searchArtistsCatalog,
} from "@/features/catalog/service";

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

/** Well-rated albums in the viewer's genres to rate during onboarding. */
export async function getOnboardingAlbums() {
  const viewer = await getViewer();
  if (!viewer) return fail(SIGNED_OUT);
  try {
    const supabase = await createClient();
    const { data: genres } = await supabase
      .from("user_favorite_genres")
      .select("genre:genres!inner(slug)")
      .eq("user_id", viewer.id);
    const slugs = (genres ?? []).map((g) => g.genre.slug).slice(0, 3);
    const pools = await Promise.all(
      (slugs.length ? slugs : [undefined]).map((genre) => browseAlbums({ sort: "popular", genre, pageSize: 12 })),
    );
    const seen = new Set<string>();
    const albums = pools.flat().filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
    if (albums.length < 8) {
      for (const a of await browseAlbums({ sort: "top", pageSize: 18 })) {
        if (!seen.has(a.id)) {
          seen.add(a.id);
          albums.push(a);
        }
      }
    }
    return ok(albums.slice(0, 12));
  } catch {
    return fail("We couldn't load albums right now.");
  }
}
