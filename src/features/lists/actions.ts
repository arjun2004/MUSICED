"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { sniffImage } from "@/lib/utils/image-validation";
import { LIST_COVER_BUCKET } from "@/lib/utils/storage";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { fail, fromZodError, ok, suspendedError, type ActionResult } from "@/lib/action-result";
import { LIST_MAX_ITEMS, listDetailsSchema, listItemNoteSchema, type ListDetailsInput } from "@/lib/validation/lists";

const SIGNED_OUT = "Sign in to manage lists.";
const id = z.uuid();

async function guard() {
  const viewer = await getViewer();
  if (!viewer) return { error: fail(SIGNED_OUT) } as const;
  const limit = await checkRateLimit("listWrite", viewer.id);
  if (!limit.allowed) return { error: fail("You're editing lists very quickly. Take a breather.") } as const;
  return { viewer, supabase: await createClient() } as const;
}

function revalidateList(listId: string) {
  revalidatePath(`/list/${listId}`);
  revalidatePath("/lists");
}

async function revalidateOwnerLists(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from("profiles").select("username").eq("id", userId).maybeSingle();
  if (data?.username) revalidatePath(`/user/${data.username}`, "layout");
}

function itemWriteError(error: { code?: string; message: string }, fallback: string): ActionResult<never> {
  const suspended = suspendedError(error);
  if (suspended) return suspended;
  if (error.code === "23505") return fail("That album is already in this list.");
  if (error.code === "23514" && error.message.includes("500")) {
    return fail(`Lists can hold up to ${LIST_MAX_ITEMS} albums.`);
  }
  if (error.code === "42501") return fail("You can only edit your own lists.");
  if (error.code === "23503") return fail("That album or list no longer exists.");
  console.error("[lists]", error.code, error.message);
  return fail(fallback);
}

/* -------------------------------------------------------------------------- */

export async function createList(
  input: ListDetailsInput,
  firstAlbumId?: string,
): Promise<ActionResult<{ id: string }>> {
  const g = await guard();
  if ("error" in g) return g.error!;
  const parsed = listDetailsSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const { data, error } = await g.supabase
    .from("user_lists")
    .insert({
      user_id: g.viewer.id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      is_ranked: parsed.data.isRanked,
      visibility: parsed.data.visibility,
    })
    .select("id")
    .single();
  if (error || !data) return itemWriteError(error ?? { message: "no row" }, "We couldn't create your list.");

  if (firstAlbumId && id.safeParse(firstAlbumId).success) {
    const { error: addError } = await g.supabase.rpc("append_list_item", {
      p_list_id: data.id,
      p_album_id: firstAlbumId,
    });
    if (addError) return itemWriteError(addError, "List created, but we couldn't add the album.");
  }

  revalidateList(data.id);
  await revalidateOwnerLists(g.supabase, g.viewer.id);
  return ok({ id: data.id }, "List created.");
}

export async function updateListDetails(listId: string, input: ListDetailsInput): Promise<ActionResult> {
  const g = await guard();
  if ("error" in g) return g.error!;
  if (!id.safeParse(listId).success) return fail("Unknown list.");
  const parsed = listDetailsSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const { data, error } = await g.supabase
    .from("user_lists")
    .update({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      is_ranked: parsed.data.isRanked,
      visibility: parsed.data.visibility,
    })
    .eq("id", listId)
    .eq("user_id", g.viewer.id)
    .select("id");
  if (error) return itemWriteError(error, "We couldn't save the list.");
  if (!data?.length) return fail("You can only edit your own lists.");

  revalidateList(listId);
  await revalidateOwnerLists(g.supabase, g.viewer.id);
  return ok(undefined, "List saved.");
}

export async function deleteList(listId: string): Promise<ActionResult<never>> {
  const g = await guard();
  if ("error" in g) return g.error!;
  if (!id.safeParse(listId).success) return fail("Unknown list.");

  const { data, error } = await g.supabase
    .from("user_lists")
    .delete()
    .eq("id", listId)
    .eq("user_id", g.viewer.id)
    .select("id");
  if (error) return fail("We couldn't delete the list.");
  if (!data?.length) return fail("You can only delete your own lists.");

  revalidatePath("/lists");
  const { data: me } = await g.supabase.from("profiles").select("username").eq("id", g.viewer.id).single();
  if (me?.username) {
    revalidatePath(`/user/${me.username}`, "layout");
    redirect(`/user/${me.username}/lists`);
  }
  redirect("/lists");
}

export async function addAlbumToList(
  listId: string,
  albumId: string,
  note?: string,
): Promise<ActionResult<{ itemId: string }>> {
  const g = await guard();
  if ("error" in g) return g.error!;
  if (!id.safeParse(listId).success || !id.safeParse(albumId).success) return fail("Unknown album or list.");
  const parsedNote = listItemNoteSchema.safeParse(note ?? "");
  if (!parsedNote.success) return fail(parsedNote.error.issues[0].message);

  const { data, error } = await g.supabase.rpc("append_list_item", {
    p_list_id: listId,
    p_album_id: albumId,
    p_note: parsedNote.data ?? undefined,
  });
  if (error || !data) return itemWriteError(error ?? { message: "no row" }, "We couldn't add that album.");

  revalidateList(listId);
  return ok({ itemId: data });
}

export async function removeAlbumFromList(listId: string, albumId: string): Promise<ActionResult> {
  const g = await guard();
  if ("error" in g) return g.error!;
  if (!id.safeParse(listId).success || !id.safeParse(albumId).success) return fail("Unknown album or list.");

  const { error } = await g.supabase.from("list_items").delete().eq("list_id", listId).eq("album_id", albumId);
  if (error) return itemWriteError(error, "We couldn't remove that album.");
  revalidateList(listId);
  return ok(undefined);
}

export async function updateListItemNote(listId: string, itemId: string, note: string): Promise<ActionResult> {
  const g = await guard();
  if ("error" in g) return g.error!;
  if (!id.safeParse(listId).success || !id.safeParse(itemId).success) return fail("Unknown item.");
  const parsed = listItemNoteSchema.safeParse(note);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const { data, error } = await g.supabase
    .from("list_items")
    .update({ note: parsed.data })
    .eq("id", itemId)
    .eq("list_id", listId)
    .select("id");
  if (error) return itemWriteError(error, "We couldn't save that note.");
  if (!data?.length) return fail("You can only edit your own lists.");
  revalidateList(listId);
  return ok(undefined);
}

export async function reorderList(listId: string, itemIds: string[]): Promise<ActionResult> {
  const g = await guard();
  if ("error" in g) return g.error!;
  const parsed = z.array(id).max(LIST_MAX_ITEMS).safeParse(itemIds);
  if (!id.safeParse(listId).success || !parsed.success) return fail("That order isn't valid.");

  const { error } = await g.supabase.rpc("reorder_list_items", { p_list_id: listId, p_item_ids: parsed.data });
  if (error) {
    if (error.code === "22023") return fail("The list changed in another tab. Refresh and try again.");
    return itemWriteError(error, "We couldn't save the new order.");
  }
  revalidateList(listId);
  return ok(undefined);
}

export async function setListLiked(listId: string, liked: boolean): Promise<ActionResult<{ liked: boolean }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in to like lists.");
  if (!id.safeParse(listId).success) return fail("Unknown list.");
  const supabase = await createClient();

  if (liked) {
    const { error } = await supabase.from("list_likes").insert({ user_id: viewer.id, list_id: listId });
    if (error && error.code !== "23505") {
      return fail(error.code === "42501" ? "You can't like this list." : "We couldn't like this list.");
    }
  } else {
    const { error } = await supabase.from("list_likes").delete().eq("user_id", viewer.id).eq("list_id", listId);
    if (error) return fail("We couldn't unlike this list.");
  }
  revalidatePath(`/list/${listId}`);
  return ok({ liked });
}

export type MyListForAlbum = {
  id: string;
  title: string;
  items_count: number;
  visibility: "public" | "followers" | "private";
  containsAlbum: boolean;
};

/** The viewer's lists, flagged with whether each already contains the album. */
export async function getMyListsForAlbum(albumId: string): Promise<ActionResult<MyListForAlbum[]>> {
  const viewer = await getViewer();
  if (!viewer) return fail(SIGNED_OUT);
  if (!id.safeParse(albumId).success) return fail("Unknown album.");

  const supabase = await createClient();
  const [{ data: lists, error }, { data: memberships }] = await Promise.all([
    supabase
      .from("user_lists")
      .select("id, title, items_count, visibility")
      .eq("user_id", viewer.id)
      .order("updated_at", { ascending: false })
      .limit(200),
    supabase
      .from("list_items")
      .select("list_id, user_lists!inner(user_id)")
      .eq("album_id", albumId)
      .eq("user_lists.user_id", viewer.id),
  ]);
  if (error) return fail("We couldn't load your lists.");

  const contains = new Set((memberships ?? []).map((m) => m.list_id));
  return ok((lists ?? []).map((l) => ({ ...l, containsAlbum: contains.has(l.id) })));
}

const COVER_MAX_BYTES = 4 * 1024 * 1024;

/** Upload a custom list cover (JPEG/PNG/WebP ≤ 4 MB, verified by magic bytes). */
export async function uploadListCover(listId: string, formData: FormData): Promise<ActionResult<{ path: string }>> {
  const g = await guard();
  if ("error" in g) return g.error!;
  if (!id.safeParse(listId).success) return fail("Unknown list.");

  const file = formData.get("cover");
  if (!(file instanceof File) || file.size === 0) return fail("Choose an image to upload.");
  if (file.size > COVER_MAX_BYTES) return fail("Covers must be 4 MB or smaller.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffImage(bytes);
  if (!sniffed) return fail("Use a JPEG, PNG or WebP image.");

  const { data: list } = await g.supabase
    .from("user_lists")
    .select("cover_path")
    .eq("id", listId)
    .eq("user_id", g.viewer.id)
    .maybeSingle();
  if (!list) return fail("You can only change your own lists.");

  const path = `${g.viewer.id}/${listId}-${randomUUID().slice(0, 8)}.${sniffed.ext}`;
  const { error: uploadError } = await g.supabase.storage
    .from(LIST_COVER_BUCKET)
    .upload(path, bytes, { contentType: sniffed.mime, cacheControl: "31536000", upsert: false });
  if (uploadError) return fail("Upload failed. Please try again.");

  const { error } = await g.supabase.from("user_lists").update({ cover_path: path }).eq("id", listId).eq("user_id", g.viewer.id);
  if (error) {
    await g.supabase.storage.from(LIST_COVER_BUCKET).remove([path]);
    return itemWriteError(error, "We couldn't save the cover.");
  }
  if (list.cover_path) await g.supabase.storage.from(LIST_COVER_BUCKET).remove([list.cover_path]);
  revalidateList(listId);
  return ok({ path }, "Cover updated.");
}

export async function removeListCover(listId: string): Promise<ActionResult> {
  const g = await guard();
  if ("error" in g) return g.error!;
  if (!id.safeParse(listId).success) return fail("Unknown list.");
  const { data: list } = await g.supabase
    .from("user_lists")
    .select("cover_path")
    .eq("id", listId)
    .eq("user_id", g.viewer.id)
    .maybeSingle();
  if (!list) return fail("You can only change your own lists.");
  const { error } = await g.supabase.from("user_lists").update({ cover_path: null }).eq("id", listId).eq("user_id", g.viewer.id);
  if (error) return itemWriteError(error, "We couldn't remove the cover.");
  if (list.cover_path) await g.supabase.storage.from(LIST_COVER_BUCKET).remove([list.cover_path]);
  revalidateList(listId);
  return ok(undefined, "Cover removed — showing the album collage.");
}
