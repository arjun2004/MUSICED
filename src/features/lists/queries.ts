import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { assertQuery } from "@/lib/supabase/errors";
import { getViewer } from "@/lib/auth/session";
import type { AlbumSummary, ProfileSummary, Visibility } from "@/types/domain";

const ALBUM_FIELDS = "id, slug, title, artist_credit, release_year, cover_url, album_type";
const OWNER_FIELDS = "id, username, display_name, avatar_path";

export type ListSummary = {
  id: string;
  title: string;
  cover_path: string | null;
  description: string | null;
  is_ranked: boolean;
  visibility: Visibility;
  items_count: number;
  likes_count: number;
  updated_at: string;
  owner: ProfileSummary;
  /** First few albums, for the cover collage. */
  preview: AlbumSummary[];
};

const SUMMARY_SELECT = `id, title, cover_path, description, is_ranked, visibility, items_count, likes_count, updated_at,
  owner:profiles!user_lists_user_id_fkey!inner(${OWNER_FIELDS}),
  list_items(position, album:albums!inner(${ALBUM_FIELDS}))`;

type SummaryRow = Omit<ListSummary, "preview"> & {
  list_items: { position: number; album: AlbumSummary }[];
};

function toSummary(row: SummaryRow): ListSummary {
  const { list_items, ...rest } = row;
  return {
    ...rest,
    preview: [...list_items].sort((a, b) => a.position - b.position).map((i) => i.album),
  };
}

/** Lists by one user that the viewer may see (RLS enforces visibility). */
export async function getUserLists(userId: string, limit = 48): Promise<ListSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_lists")
    .select(SUMMARY_SELECT)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .order("position", { referencedTable: "list_items", ascending: true })
    .limit(5, { referencedTable: "list_items" })
    .limit(limit);
  assertQuery(error, "lists");
  return ((data ?? []) as unknown as SummaryRow[]).map(toSummary);
}

/** Public lists across MUSICED. */
export async function getPublicLists(sort: "popular" | "recent", limit = 24): Promise<ListSummary[]> {
  const supabase = await createClient();
  let query = supabase
    .from("user_lists")
    .select(SUMMARY_SELECT)
    .eq("visibility", "public")
    .gt("items_count", 0);
  query =
    sort === "popular"
      ? query.order("likes_count", { ascending: false }).order("updated_at", { ascending: false })
      : query.order("updated_at", { ascending: false });
  const { data, error } = await query
    .order("position", { referencedTable: "list_items", ascending: true })
    .limit(5, { referencedTable: "list_items" })
    .limit(limit);
  assertQuery(error, "lists");
  return ((data ?? []) as unknown as SummaryRow[]).map(toSummary);
}

/** Public lists that include an album. */
export async function getListsWithAlbum(albumId: string, limit = 4): Promise<ListSummary[]> {
  const supabase = await createClient();
  const { data: memberships, error: mError } = await supabase
    .from("list_items")
    .select("list_id")
    .eq("album_id", albumId)
    .limit(100);
  assertQuery(mError, "lists");
  const ids = [...new Set((memberships ?? []).map((m) => m.list_id))];
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("user_lists")
    .select(SUMMARY_SELECT)
    .in("id", ids)
    .eq("visibility", "public")
    .order("likes_count", { ascending: false })
    .order("position", { referencedTable: "list_items", ascending: true })
    .limit(5, { referencedTable: "list_items" })
    .limit(limit);
  assertQuery(error, "lists");
  return ((data ?? []) as unknown as SummaryRow[]).map(toSummary);
}

export type ListDetail = Omit<ListSummary, "preview"> & {
  created_at: string;
  items: { id: string; position: number; note: string | null; album: AlbumSummary }[];
  isOwner: boolean;
  viewerLiked: boolean;
  isSignedIn: boolean;
};

/** A full list, or null when it doesn't exist or the viewer may not see it. */
export const getList = cache(async (listId: string): Promise<ListDetail | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(listId)) return null;
  const supabase = await createClient();
  const [viewer, { data, error }] = await Promise.all([
    getViewer(),
    supabase
      .from("user_lists")
      .select(
        `id, title, cover_path, description, is_ranked, visibility, items_count, likes_count, created_at, updated_at,
         owner:profiles!user_lists_user_id_fkey!inner(${OWNER_FIELDS}),
         list_items(id, position, note, album:albums!inner(${ALBUM_FIELDS}))`,
      )
      .eq("id", listId)
      .order("position", { referencedTable: "list_items", ascending: true })
      .maybeSingle(),
  ]);
  assertQuery(error, "list");
  if (!data) return null;

  let viewerLiked = false;
  if (viewer) {
    const { count } = await supabase
      .from("list_likes")
      .select("list_id", { head: true, count: "exact" })
      .eq("list_id", listId)
      .eq("user_id", viewer.id);
    viewerLiked = (count ?? 0) > 0;
  }

  const { list_items, ...rest } = data as unknown as Omit<ListDetail, "items" | "isOwner" | "viewerLiked" | "isSignedIn"> & {
    list_items: ListDetail["items"];
  };
  return {
    ...rest,
    items: list_items,
    isOwner: viewer?.id === rest.owner.id,
    viewerLiked,
    isSignedIn: Boolean(viewer),
  };
});
