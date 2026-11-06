"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { AVATAR_BUCKET, LIST_COVER_BUCKET } from "@/lib/utils/storage";
import { sniffImage } from "@/lib/utils/image-validation";
import {
  AVATAR_MAX_BYTES,
  preferencesSchema,
  profileSchema,
  type PreferencesInput,
  type ProfileInput,
} from "@/lib/validation/profile";
import { usernameSchema } from "@/lib/validation/auth";

const SIGNED_OUT = "Your session has ended. Please sign in again.";

/** Maps Postgres errors from profile writes to friendly field errors. */
function profileWriteError(error: { code?: string; message: string }): ActionResult<never> {
  if (error.code === "23505") {
    return fail("That username is taken.", { username: "That username is taken" });
  }
  if (error.code === "23514") {
    if (error.message.includes("username_reserved")) {
      return fail("That username is reserved.", { username: "That username is reserved" });
    }
    return fail("Some details aren't valid. Please check and try again.");
  }
  console.error("[profile] write failed", error.code, error.message);
  return fail("We couldn't save your profile. Please try again.");
}

export async function checkUsernameAvailability(
  raw: string,
): Promise<ActionResult<{ available: boolean }>> {
  const parsed = usernameSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid username");

  const viewer = await getViewer();
  const limit = await checkRateLimit("usernameCheck", viewer?.id ?? "anon");
  if (!limit.allowed) return fail("Slow down a little.");

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", parsed.data)
    .maybeSingle();

  return ok({ available: !data || data.id === viewer?.id });
}

export async function updateProfile(input: ProfileInput): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail(SIGNED_OUT);

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", viewer.id)
    .single();

  const { error } = await supabase
    .from("profiles")
    .update({
      username: parsed.data.username,
      display_name: parsed.data.displayName ?? null,
      bio: parsed.data.bio ?? null,
      location: parsed.data.location ?? null,
      website: parsed.data.website ?? null,
    })
    .eq("id", viewer.id);

  if (error) return profileWriteError(error);

  revalidatePath(`/user/${parsed.data.username}`);
  if (before?.username && before.username !== parsed.data.username) {
    revalidatePath(`/user/${before.username}`);
  }
  revalidatePath("/", "layout");
  return ok(undefined, "Profile saved.");
}

export async function uploadAvatar(formData: FormData): Promise<ActionResult<{ path: string }>> {
  const viewer = await getViewer();
  if (!viewer) return fail(SIGNED_OUT);

  const limit = await checkRateLimit("avatarUpload", viewer.id);
  if (!limit.allowed) return fail("You've changed your avatar a lot recently. Try again later.");

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return fail("Choose an image to upload.");
  if (file.size > AVATAR_MAX_BYTES) return fail("Images must be 2 MB or smaller.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffImage(bytes);
  if (!sniffed) return fail("Use a JPEG, PNG or WebP image.");

  const supabase = await createClient();
  const path = `${viewer.id}/${randomUUID()}.${sniffed.ext}`;

  // Uploaded as the user: storage RLS only allows writes into `<uid>/`.
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, bytes, { contentType: sniffed.mime, cacheControl: "31536000", upsert: false });
  if (uploadError) {
    console.error("[avatar] upload failed", uploadError.message);
    return fail("Upload failed. Please try again.");
  }

  const { data: previous } = await supabase
    .from("profiles")
    .select("avatar_path, username")
    .eq("id", viewer.id)
    .single();

  const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", viewer.id);
  if (error) {
    await supabase.storage.from(AVATAR_BUCKET).remove([path]);
    return profileWriteError(error);
  }

  if (previous?.avatar_path && previous.avatar_path !== path) {
    await supabase.storage.from(AVATAR_BUCKET).remove([previous.avatar_path]);
  }

  if (previous?.username) revalidatePath(`/user/${previous.username}`);
  revalidatePath("/", "layout");
  return ok({ path }, "Avatar updated.");
}

export async function removeAvatar(): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail(SIGNED_OUT);

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_path, username")
    .eq("id", viewer.id)
    .single();

  const { error } = await supabase.from("profiles").update({ avatar_path: null }).eq("id", viewer.id);
  if (error) return profileWriteError(error);

  if (profile?.avatar_path) await supabase.storage.from(AVATAR_BUCKET).remove([profile.avatar_path]);
  if (profile?.username) revalidatePath(`/user/${profile.username}`);
  revalidatePath("/", "layout");
  return ok(undefined, "Avatar removed.");
}

export async function updatePreferences(input: PreferencesInput): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail(SIGNED_OUT);

  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_preferences")
    .update({
      default_log_visibility: parsed.data.defaultLogVisibility,
      default_review_visibility: parsed.data.defaultReviewVisibility,
      default_list_visibility: parsed.data.defaultListVisibility,
      notify_follows: parsed.data.notifyFollows,
      notify_likes: parsed.data.notifyLikes,
      notify_comments: parsed.data.notifyComments,
      notify_mentions: parsed.data.notifyMentions,
    })
    .eq("user_id", viewer.id);

  if (error) {
    console.error("[preferences] update failed", error.message);
    return fail("We couldn't save your preferences.");
  }
  revalidatePath("/settings/preferences");
  return ok(undefined, "Preferences saved.");
}

/**
 * Permanently delete the signed-in account. Requires the username typed out and
 * the current password. Uses the service role (deleting an auth user is a
 * system operation); everything the user owns cascades from profiles.
 */
export async function deleteAccount(input: { username: string; password: string }): Promise<ActionResult<never>> {
  const viewer = await getViewer();
  if (!viewer?.email) return fail(SIGNED_OUT);

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("username, role").eq("id", viewer.id).single();
  if (!profile?.username || input.username.trim().toLowerCase() !== profile.username) {
    return fail("Type your username exactly to confirm.");
  }
  if (profile.role === "admin" || profile.role === "moderator") {
    return fail("Staff accounts must be removed by another admin (they anchor the moderation audit log).");
  }

  const limit = await checkRateLimit("signIn", viewer.id);
  if (!limit.allowed) return fail("Too many attempts. Try again later.");

  // Re-verify the password with a throwaway, cookie-less client so the
  // current session isn't replaced.
  const verifier = createPublicClient();
  const { error: authError } = await verifier.auth.signInWithPassword({ email: viewer.email, password: input.password });
  if (authError) return fail("That password isn't right.");

  const admin = createAdminClient();
  if (!admin) return fail("Account deletion isn't configured on this server (missing SUPABASE_SECRET_KEY).");

  // Remove uploaded files first (storage objects don't cascade).
  for (const bucket of [AVATAR_BUCKET, LIST_COVER_BUCKET]) {
    const { data: files } = await admin.storage.from(bucket).list(viewer.id, { limit: 1000 });
    if (files?.length) await admin.storage.from(bucket).remove(files.map((f) => `${viewer.id}/${f.name}`));
  }

  const { error } = await admin.auth.admin.deleteUser(viewer.id);
  if (error) {
    console.error("[account] delete failed", error.message);
    return fail("We couldn't delete your account. Please contact support.");
  }

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/?deleted=1");
}
