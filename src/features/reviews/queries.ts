import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { assertQuery } from "@/lib/supabase/errors";
import { getViewer } from "@/lib/auth/session";
import type { AlbumSummary, ProfileSummary, Visibility } from "@/types/domain";

export type ReviewDetail = {
  id: string;
  title: string | null;
  body: string;
  rating: number | null;
  contains_spoilers: boolean;
  visibility: Visibility;
  likes_count: number;
  comments_count: number;
  created_at: string;
  edited_at: string | null;
  author: ProfileSummary;
  album: AlbumSummary;
  isAuthor: boolean;
  viewerLiked: boolean;
  viewerId: string | null;
};

export const getReview = cache(async (reviewId: string): Promise<ReviewDetail | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(reviewId)) return null;
  const supabase = await createClient();
  const [viewer, { data, error }] = await Promise.all([
    getViewer(),
    supabase
      .from("reviews")
      .select(
        `id, title, body, rating, contains_spoilers, visibility, likes_count, comments_count, created_at, edited_at,
         author:profiles!reviews_user_id_fkey!inner(id, username, display_name, avatar_path),
         album:albums!inner(id, slug, title, artist_credit, release_year, cover_url, album_type)`,
      )
      .eq("id", reviewId)
      .maybeSingle(),
  ]);
  assertQuery(error, "review");
  if (!data) return null;

  let viewerLiked = false;
  if (viewer) {
    const { count } = await supabase
      .from("review_likes")
      .select("review_id", { head: true, count: "exact" })
      .eq("review_id", reviewId)
      .eq("user_id", viewer.id);
    viewerLiked = (count ?? 0) > 0;
  }
  const row = data as unknown as Omit<ReviewDetail, "isAuthor" | "viewerLiked" | "viewerId">;
  return {
    ...row,
    rating: row.rating === null ? null : Number(row.rating),
    isAuthor: viewer?.id === row.author.id,
    viewerLiked,
    viewerId: viewer?.id ?? null,
  };
});

export type CommentNode = {
  id: string;
  body: string;
  parent_id: string | null;
  likes_count: number;
  created_at: string;
  edited_at: string | null;
  author: ProfileSummary;
  viewerLiked: boolean;
  replies: CommentNode[];
};

/** Comments as a one-level thread, oldest first. Blocked authors are hidden by RLS. */
export async function getComments(reviewId: string): Promise<CommentNode[]> {
  const supabase = await createClient();
  const [viewer, { data, error }] = await Promise.all([
    getViewer(),
    supabase
      .from("review_comments")
      .select(
        `id, body, parent_id, likes_count, created_at, edited_at,
         author:profiles!review_comments_user_id_fkey!inner(id, username, display_name, avatar_path)`,
      )
      .eq("review_id", reviewId)
      .order("created_at", { ascending: true })
      .limit(500),
  ]);
  assertQuery(error, "comments");
  const rows = (data ?? []) as unknown as Omit<CommentNode, "viewerLiked" | "replies">[];

  let liked = new Set<string>();
  if (viewer && rows.length) {
    const { data: likes } = await supabase
      .from("comment_likes")
      .select("comment_id")
      .eq("user_id", viewer.id)
      .in("comment_id", rows.map((r) => r.id));
    liked = new Set((likes ?? []).map((l) => l.comment_id));
  }

  const nodes = new Map<string, CommentNode>();
  for (const row of rows) nodes.set(row.id, { ...row, viewerLiked: liked.has(row.id), replies: [] });
  const roots: CommentNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parent_id ? nodes.get(node.parent_id) : null;
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }
  return roots;
}
