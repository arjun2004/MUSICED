"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/session";
import { fail, ok, type ActionResult } from "@/lib/action-result";

export async function markAllNotificationsRead(): Promise<ActionResult<{ updated: number }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in first.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_all_notifications_read");
  if (error) return fail("We couldn't update your notifications.");
  revalidatePath("/notifications");
  return ok({ updated: data ?? 0 });
}

export async function getUnreadCount(): Promise<number> {
  const viewer = await getViewer();
  if (!viewer) return 0;
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { head: true, count: "exact" })
    .eq("recipient_id", viewer.id)
    .is("read_at", null);
  return count ?? 0;
}
