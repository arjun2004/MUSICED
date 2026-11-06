"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { fail, ok, suspendedError, type ActionResult } from "@/lib/action-result";
import { commentSchema } from "@/lib/validation/listening";

const id = z.uuid();

export async function setReviewLiked(reviewId: string, liked: boolean): Promise<ActionResult<{ liked: boolean }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in to like reviews.");
  if (!id.safeParse(reviewId).success) return fail("Unknown review.");
  const supabase = await createClient();

  if (liked) {
    const { error } = await supabase.from("review_likes").insert({ user_id: viewer.id, review_id: reviewId });
    if (error && error.code !== "23505") {
      return suspendedError(error) ?? fail(error.code === "42501" ? "You can't like this review." : "We couldn't like this review.");
    }
  } else {
    const { error } = await supabase.from("review_likes").delete().eq("user_id", viewer.id).eq("review_id", reviewId);
    if (error) return fail("We couldn't unlike this review.");
  }
  revalidatePath(`/review/${reviewId}`);
  return ok({ liked });
}

export type PostedComment = {
  id: string;
  body: string;
  parent_id: string | null;
  created_at: string;
};

export async function addComment(
  reviewId: string,
  body: string,
  parentId?: string | null,
): Promise<ActionResult<PostedComment>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in to comment.");
  if (!id.safeParse(reviewId).success || (parentId && !id.safeParse(parentId).success)) return fail("Unknown review.");
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const limit = await checkRateLimit("comment", viewer.id);
  if (!limit.allowed) return fail("You're commenting a lot. Take a breather and try again soon.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("review_comments")
    .insert({ review_id: reviewId, user_id: viewer.id, body: parsed.data, parent_id: parentId ?? null })
    .select("id, body, parent_id, created_at")
    .single();
  if (error || !data) {
    const suspended = suspendedError(error);
    if (suspended) return suspended;
    if (error?.code === "42501") return fail("You can't comment on this review.");
    if (error?.code === "23514") return fail(error.message.includes("one level") ? "Replies can only go one level deep." : "That comment isn't allowed.");
    return fail("We couldn't post your comment.");
  }
  revalidatePath(`/review/${reviewId}`);
  return ok(data);
}

export async function editComment(commentId: string, body: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in first.");
  if (!id.safeParse(commentId).success) return fail("Unknown comment.");
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("review_comments")
    .update({ body: parsed.data })
    .eq("id", commentId)
    .eq("user_id", viewer.id)
    .select("review_id");
  if (error) return fail("We couldn't save your edit.");
  if (!data?.length) return fail("You can only edit your own comments.");
  revalidatePath(`/review/${data[0].review_id}`);
  return ok(undefined);
}

/** Authors can delete their comments; review owners can delete any comment on their review (RLS). */
export async function deleteComment(commentId: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in first.");
  if (!id.safeParse(commentId).success) return fail("Unknown comment.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("review_comments").delete().eq("id", commentId).select("review_id");
  if (error) return fail("We couldn't delete that comment.");
  if (!data?.length) return fail("You can't delete that comment.");
  revalidatePath(`/review/${data[0].review_id}`);
  return ok(undefined);
}

export async function setCommentLiked(commentId: string, liked: boolean): Promise<ActionResult<{ liked: boolean }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in to like comments.");
  if (!id.safeParse(commentId).success) return fail("Unknown comment.");
  const supabase = await createClient();
  if (liked) {
    const { error } = await supabase.from("comment_likes").insert({ user_id: viewer.id, comment_id: commentId });
    if (error && error.code !== "23505") return fail("We couldn't like that comment.");
  } else {
    const { error } = await supabase.from("comment_likes").delete().eq("user_id", viewer.id).eq("comment_id", commentId);
    if (error) return fail("We couldn't unlike that comment.");
  }
  return ok({ liked });
}
