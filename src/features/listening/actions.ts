"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { fail, fromZodError, ok, suspendedError, type ActionResult } from "@/lib/action-result";
import { logSchema, ratingSchema, reviewSchema, type LogInput, type ReviewInput } from "@/lib/validation/listening";

const id = z.uuid();
type Supabase = Awaited<ReturnType<typeof createClient>>;

async function session() {
  const viewer = await getViewer();
  if (!viewer) return { error: fail("Sign in to keep your diary.") } as const;
  const limit = await checkRateLimit("listeningWrite", viewer.id);
  if (!limit.allowed) return { error: fail("You're going a bit fast. Try again in a minute.") } as const;
  return { viewer, supabase: await createClient() } as const;
}

async function albumPath(supabase: Supabase, albumId: string) {
  const { data } = await supabase.from("albums").select("slug").eq("id", albumId).maybeSingle();
  return data ? `/album/${data.slug}` : null;
}

/** Refresh everything that shows this viewer's relationship with this album. */
async function refresh(supabase: Supabase, viewerId: string, albumId: string) {
  // Read-your-own-writes: expire the cached aggregates immediately.
  updateTag(`album-stats:${albumId}`);
  updateTag("album-stats");
  const path = await albumPath(supabase, albumId);
  if (path) revalidatePath(path);
  const { data } = await supabase.from("profiles").select("username").eq("id", viewerId).maybeSingle();
  if (data?.username) revalidatePath(`/user/${data.username}`, "layout");
  revalidatePath("/");
}

function writeError(error: { code?: string; message: string }, fallback: string): ActionResult<never> {
  const suspended = suspendedError(error);
  if (suspended) return suspended;
  if (error.code === "23514") return fail("That value isn't allowed.");
  if (error.code === "23503") return fail("That album no longer exists.");
  if (error.code === "42501") return fail("You can only change your own entries.");
  console.error("[listening]", error.code, error.message);
  return fail(fallback);
}

/**
 * Set or clear the viewer's current rating. Update-then-insert keeps writes
 * within the columns clients are granted (rating only on update).
 */
async function writeRating(supabase: Supabase, viewerId: string, albumId: string, rating: number | null) {
  if (rating === null) {
    return supabase.from("album_ratings").delete().eq("user_id", viewerId).eq("album_id", albumId);
  }
  const updated = await supabase
    .from("album_ratings")
    .update({ rating })
    .eq("user_id", viewerId)
    .eq("album_id", albumId)
    .select("id");
  if (updated.error || (updated.data?.length ?? 0) > 0) return updated;
  const inserted = await supabase.from("album_ratings").insert({ user_id: viewerId, album_id: albumId, rating });
  if (inserted.error?.code === "23505") {
    return supabase.from("album_ratings").update({ rating }).eq("user_id", viewerId).eq("album_id", albumId);
  }
  return inserted;
}

/* -------------------------------------------------------------------------- */

export async function setRating(albumId: string, rating: number | null): Promise<ActionResult<{ rating: number | null }>> {
  const s = await session();
  if ("error" in s) return s.error!;
  if (!id.safeParse(albumId).success) return fail("Unknown album.");
  if (rating !== null && !ratingSchema.safeParse(rating).success) return fail("Ratings move in half stars from ½ to 5.");

  const { error } = await writeRating(s.supabase, s.viewer.id, albumId, rating);
  if (error) return writeError(error, "We couldn't save your rating.");
  await refresh(s.supabase, s.viewer.id, albumId);
  return ok({ rating });
}

export async function logListen(albumId: string, input: LogInput): Promise<ActionResult<{ id: string }>> {
  const s = await session();
  if ("error" in s) return s.error!;
  if (!id.safeParse(albumId).success) return fail("Unknown album.");
  const parsed = logSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const v = parsed.data;

  const { data, error } = await s.supabase
    .from("listening_logs")
    .insert({
      user_id: s.viewer.id,
      album_id: albumId,
      listened_on: v.listenedOn,
      rating: v.rating,
      note: v.note ?? null,
      is_relisten: v.isRelisten,
      is_favorite: v.isFavorite,
      visibility: v.visibility,
    })
    .select("id")
    .single();
  if (error || !data) return writeError(error ?? { message: "no row" }, "We couldn't log that listen.");

  // A rating given while logging becomes the album's current rating too.
  if (v.rating !== null) await writeRating(s.supabase, s.viewer.id, albumId, v.rating);

  await refresh(s.supabase, s.viewer.id, albumId);
  return ok({ id: data.id }, "Logged to your diary.");
}

export async function updateLog(logId: string, input: LogInput): Promise<ActionResult> {
  const s = await session();
  if ("error" in s) return s.error!;
  if (!id.safeParse(logId).success) return fail("Unknown diary entry.");
  const parsed = logSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const v = parsed.data;

  const { data, error } = await s.supabase
    .from("listening_logs")
    .update({
      listened_on: v.listenedOn,
      rating: v.rating,
      note: v.note ?? null,
      is_relisten: v.isRelisten,
      is_favorite: v.isFavorite,
      visibility: v.visibility,
    })
    .eq("id", logId)
    .eq("user_id", s.viewer.id)
    .select("album_id");
  if (error) return writeError(error, "We couldn't update that entry.");
  if (!data?.length) return fail("You can only edit your own diary.");
  await refresh(s.supabase, s.viewer.id, data[0].album_id);
  return ok(undefined, "Diary entry updated.");
}

export async function deleteLog(logId: string): Promise<ActionResult> {
  const s = await session();
  if ("error" in s) return s.error!;
  if (!id.safeParse(logId).success) return fail("Unknown diary entry.");
  const { data, error } = await s.supabase
    .from("listening_logs")
    .delete()
    .eq("id", logId)
    .eq("user_id", s.viewer.id)
    .select("album_id");
  if (error) return writeError(error, "We couldn't delete that entry.");
  if (!data?.length) return fail("You can only delete your own diary entries.");
  await refresh(s.supabase, s.viewer.id, data[0].album_id);
  return ok(undefined, "Diary entry deleted.");
}

export async function saveReview(albumId: string, input: ReviewInput): Promise<ActionResult<{ id: string }>> {
  const s = await session();
  if ("error" in s) return s.error!;
  if (!id.safeParse(albumId).success) return fail("Unknown album.");
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const v = parsed.data;
  const fields = {
    title: v.title ?? null,
    body: v.body,
    rating: v.rating,
    contains_spoilers: v.containsSpoilers,
    visibility: v.visibility,
  };

  // One main review per album: update if it exists, otherwise create.
  const updated = await s.supabase
    .from("reviews")
    .update(fields)
    .eq("user_id", s.viewer.id)
    .eq("album_id", albumId)
    .select("id");
  if (updated.error) return writeError(updated.error, "We couldn't save your review.");

  let reviewId = updated.data?.[0]?.id;
  if (!reviewId) {
    const inserted = await s.supabase
      .from("reviews")
      .insert({ user_id: s.viewer.id, album_id: albumId, ...fields })
      .select("id")
      .single();
    if (inserted.error || !inserted.data) {
      return writeError(inserted.error ?? { message: "no row" }, "We couldn't publish your review.");
    }
    reviewId = inserted.data.id;
  }

  if (v.rating !== null) await writeRating(s.supabase, s.viewer.id, albumId, v.rating);
  await refresh(s.supabase, s.viewer.id, albumId);
  revalidatePath(`/review/${reviewId}`);
  return ok({ id: reviewId }, updated.data?.length ? "Review updated." : "Review published.");
}

export async function deleteReview(reviewId: string): Promise<ActionResult> {
  const s = await session();
  if ("error" in s) return s.error!;
  if (!id.safeParse(reviewId).success) return fail("Unknown review.");
  const { data, error } = await s.supabase
    .from("reviews")
    .delete()
    .eq("id", reviewId)
    .eq("user_id", s.viewer.id)
    .select("album_id");
  if (error) return writeError(error, "We couldn't delete your review.");
  if (!data?.length) return fail("You can only delete your own reviews.");
  await refresh(s.supabase, s.viewer.id, data[0].album_id);
  return ok(undefined, "Review deleted.");
}

export async function setFavorite(albumId: string, favorite: boolean): Promise<ActionResult<{ favorite: boolean; slot: number | null }>> {
  const s = await session();
  if ("error" in s) return s.error!;
  if (!id.safeParse(albumId).success) return fail("Unknown album.");

  let slot: number | null = null;
  if (favorite) {
    const { data, error } = await s.supabase.rpc("add_favorite_album", { p_album_id: albumId });
    if (error) return writeError(error, "We couldn't add that favourite.");
    slot = data ?? null;
  } else {
    const { error } = await s.supabase.from("favorite_albums").delete().eq("user_id", s.viewer.id).eq("album_id", albumId);
    if (error) return writeError(error, "We couldn't remove that favourite.");
  }
  await refresh(s.supabase, s.viewer.id, albumId);
  return ok({ favorite, slot });
}

/** Choose and order the four albums pinned to the profile. */
export async function setFavoriteShowcase(albumIds: string[]): Promise<ActionResult> {
  const s = await session();
  if ("error" in s) return s.error!;
  const parsed = z.array(id).max(4).safeParse(albumIds);
  if (!parsed.success) return fail("Pick up to four albums.");
  const { error } = await s.supabase.rpc("set_favorite_showcase", { p_album_ids: parsed.data });
  if (error) return writeError(error, "We couldn't save your favourites.");
  const { data } = await s.supabase.from("profiles").select("username").eq("id", s.viewer.id).maybeSingle();
  if (data?.username) revalidatePath(`/user/${data.username}`, "layout");
  return ok(undefined, "Profile favourites saved.");
}
