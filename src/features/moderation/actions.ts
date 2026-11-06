"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { reportSchema, type ReportInput } from "@/lib/validation/listening";

/**
 * File a report. One report per reporter per target (unique constraint), so
 * repeat reports are acknowledged without creating duplicates.
 */
export async function reportContent(input: ReportInput): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in to report content.");
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const limit = await checkRateLimit("report", viewer.id);
  if (!limit.allowed) return fail("You've filed a lot of reports today. Our team will get to them.");

  const supabase = await createClient();
  const { error } = await supabase.from("reports").insert({
    reporter_id: viewer.id,
    target_type: parsed.data.targetType,
    target_id: parsed.data.targetId,
    reason: parsed.data.reason,
    details: parsed.data.details ?? null,
  });
  if (error && error.code !== "23505") {
    console.error("[report]", error.code, error.message);
    return fail("We couldn't send your report. Please try again.");
  }
  return ok(undefined, "Thanks — our moderators will take a look.");
}

const MOD_ACTIONS = ["dismiss", "warn", "hide_content", "restore_content", "delete_content", "suspend_user", "unsuspend_user"] as const;

/** Staff action on reported content. Authorisation and audit happen in moderate_content(). */
export async function moderate(input: {
  action: (typeof MOD_ACTIONS)[number];
  targetType: "review" | "comment" | "list" | "profile";
  targetId: string;
  reason: string;
}): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in first.");
  if (!MOD_ACTIONS.includes(input.action)) return fail("Unknown action.");
  if (!["review", "comment", "list", "profile"].includes(input.targetType)) return fail("Unknown target.");
  if (!/^[0-9a-f-]{36}$/i.test(input.targetId)) return fail("Unknown target.");
  const reason = input.reason.trim();
  if (reason.length < 3 || reason.length > 2000) return fail("Give a short reason (it's kept in the audit log).");

  const supabase = await createClient();
  const { error } = await supabase.rpc("moderate_content", {
    p_action: input.action,
    p_target_type: input.targetType,
    p_target_id: input.targetId,
    p_reason: reason,
  });
  if (error) {
    if (error.code === "42501") return fail("Only moderators can do that.");
    return fail(error.message || "That action failed.");
  }
  revalidatePath("/admin/moderation");
  return ok(undefined, "Done. Logged to the audit trail.");
}
