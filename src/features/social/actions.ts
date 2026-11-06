"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { fail, ok, suspendedError, type ActionResult } from "@/lib/action-result";

const userIdSchema = z.uuid();

/**
 * The follower is ALWAYS the verified viewer; only the target id comes from
 * the client. RLS enforces the same rule independently.
 */
export async function setFollowing(
  targetUserId: string,
  follow: boolean,
): Promise<ActionResult<{ following: boolean }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in to follow listeners.");

  const target = userIdSchema.safeParse(targetUserId);
  if (!target.success) return fail("Unknown listener.");
  if (target.data === viewer.id) return fail("You can't follow yourself.");

  const supabase = await createClient();

  if (follow) {
    const limit = await checkRateLimit("follow", viewer.id);
    if (!limit.allowed) return fail("You're following a lot of people quickly. Take a breather.");

    const { error } = await supabase
      .from("user_follows")
      .insert({ follower_id: viewer.id, following_id: target.data });
    // 23505 = already following; treat as success (idempotent).
    if (error && error.code !== "23505") {
      const suspended = suspendedError(error);
      if (suspended) return suspended;
      if (error.code === "42501") return fail("You can't follow this listener.");
      if (error.code === "23503") return fail("That listener no longer exists.");
      console.error("[follow] insert failed", error.code, error.message);
      return fail("We couldn't follow this listener. Please try again.");
    }
  } else {
    const { error } = await supabase
      .from("user_follows")
      .delete()
      .eq("follower_id", viewer.id)
      .eq("following_id", target.data);
    if (error) return fail("We couldn't unfollow this listener. Please try again.");
  }

  await revalidateProfile(supabase, target.data);
  return ok({ following: follow });
}

export async function setBlocked(
  targetUserId: string,
  block: boolean,
): Promise<ActionResult<{ blocked: boolean }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in first.");

  const target = userIdSchema.safeParse(targetUserId);
  if (!target.success || target.data === viewer.id) return fail("Unknown listener.");

  const supabase = await createClient();
  if (block) {
    const { error } = await supabase
      .from("user_blocks")
      .insert({ blocker_id: viewer.id, blocked_id: target.data });
    if (error && error.code !== "23505") return fail("We couldn't block this listener.");
  } else {
    const { error } = await supabase
      .from("user_blocks")
      .delete()
      .eq("blocker_id", viewer.id)
      .eq("blocked_id", target.data);
    if (error) return fail("We couldn't unblock this listener.");
  }

  await revalidateProfile(supabase, target.data);
  revalidatePath("/", "layout");
  return ok({ blocked: block });
}

async function revalidateProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data } = await supabase.from("profiles").select("username").eq("id", userId).maybeSingle();
  if (data?.username) revalidatePath(`/user/${data.username}`, "layout");
}
