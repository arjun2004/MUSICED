import "server-only";

import { createClient } from "@/lib/supabase/server";
import { assertQuery } from "@/lib/supabase/errors";
import type { Enums } from "@/types/database";

export type ReportTargetPreview = {
  exists: boolean;
  title: string;
  excerpt: string | null;
  href: string | null;
  authorId: string | null;
  authorUsername: string | null;
  hidden: boolean;
  suspended: boolean;
};

export type QueuedReport = {
  targetType: Enums<"report_target">;
  targetId: string;
  reports: { id: string; reason: Enums<"report_reason">; details: string | null; created_at: string; reporter: string }[];
  firstReportedAt: string;
  preview: ReportTargetPreview;
};

/**
 * Open reports grouped by target, oldest first, each with a preview of the
 * reported content. Readable only by moderators (RLS).
 */
export async function getReportQueue(status: "open" | "closed" = "open"): Promise<QueuedReport[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reports")
    .select("id, target_type, target_id, reason, details, created_at, status, reporter:profiles!reports_reporter_id_fkey(username)")
    .in("status", status === "open" ? ["open", "reviewing"] : ["resolved", "dismissed"])
    .order("created_at", { ascending: status === "open" })
    .limit(300);
  assertQuery(error, "reports");

  const groups = new Map<string, QueuedReport>();
  for (const r of data ?? []) {
    const key = `${r.target_type}:${r.target_id}`;
    const group =
      groups.get(key) ??
      ({
        targetType: r.target_type,
        targetId: r.target_id,
        reports: [],
        firstReportedAt: r.created_at,
        preview: { exists: false, title: "", excerpt: null, href: null, authorId: null, authorUsername: null, hidden: false, suspended: false },
      } satisfies QueuedReport);
    group.reports.push({
      id: r.id,
      reason: r.reason,
      details: r.details,
      created_at: r.created_at,
      reporter: r.reporter?.username ?? "deleted account",
    });
    groups.set(key, group);
  }

  const queue = [...groups.values()];
  await Promise.all(queue.map(async (item) => (item.preview = await previewTarget(supabase, item.targetType, item.targetId))));
  return queue;
}

async function previewTarget(
  supabase: Awaited<ReturnType<typeof createClient>>,
  type: Enums<"report_target">,
  id: string,
): Promise<ReportTargetPreview> {
  const missing: ReportTargetPreview = {
    exists: false,
    title: "Content no longer exists",
    excerpt: null,
    href: null,
    authorId: null,
    authorUsername: null,
    hidden: false,
    suspended: false,
  };

  if (type === "review") {
    const { data } = await supabase
      .from("reviews")
      .select("id, body, title, hidden_at, album:albums!inner(title), author:profiles!reviews_user_id_fkey!inner(id, username, suspended_at)")
      .eq("id", id)
      .maybeSingle();
    if (!data) return missing;
    const a = data.author as unknown as { id: string; username: string; suspended_at: string | null };
    return {
      exists: true,
      title: `Review of ${data.album.title}${data.title ? ` — “${data.title}”` : ""}`,
      excerpt: data.body.slice(0, 400),
      href: `/review/${data.id}`,
      authorId: a.id,
      authorUsername: a.username,
      hidden: Boolean(data.hidden_at),
      suspended: Boolean(a.suspended_at),
    };
  }
  if (type === "comment") {
    const { data } = await supabase
      .from("review_comments")
      .select("id, body, review_id, hidden_at, author:profiles!review_comments_user_id_fkey!inner(id, username, suspended_at)")
      .eq("id", id)
      .maybeSingle();
    if (!data) return missing;
    const a = data.author as unknown as { id: string; username: string; suspended_at: string | null };
    return {
      exists: true,
      title: "Comment",
      excerpt: data.body.slice(0, 400),
      href: `/review/${data.review_id}#comments-heading`,
      authorId: a.id,
      authorUsername: a.username,
      hidden: Boolean(data.hidden_at),
      suspended: Boolean(a.suspended_at),
    };
  }
  if (type === "list") {
    const { data } = await supabase
      .from("user_lists")
      .select("id, title, description, hidden_at, author:profiles!user_lists_user_id_fkey!inner(id, username, suspended_at)")
      .eq("id", id)
      .maybeSingle();
    if (!data) return missing;
    const a = data.author as unknown as { id: string; username: string; suspended_at: string | null };
    return {
      exists: true,
      title: `List: ${data.title}`,
      excerpt: data.description,
      href: `/list/${data.id}`,
      authorId: a.id,
      authorUsername: a.username,
      hidden: Boolean(data.hidden_at),
      suspended: Boolean(a.suspended_at),
    };
  }
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, suspended_at")
    .eq("id", id)
    .maybeSingle();
  if (!data?.username) return missing;
  return {
    exists: true,
    title: `Profile: ${data.display_name || data.username}`,
    excerpt: data.bio,
    href: `/user/${data.username}`,
    authorId: data.id,
    authorUsername: data.username,
    hidden: false,
    suspended: Boolean(data.suspended_at),
  };
}

export type ModerationLogEntry = {
  id: string;
  action: Enums<"moderation_action_type">;
  target_type: Enums<"report_target">;
  target_id: string;
  reason: string;
  created_at: string;
  moderator: string;
};

/** Append-only audit trail of staff actions. */
export async function getModerationLog(limit = 50): Promise<ModerationLogEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("moderation_actions")
    .select("id, action, target_type, target_id, reason, created_at, moderator:profiles!moderation_actions_moderator_id_fkey(username)")
    .order("created_at", { ascending: false })
    .limit(limit);
  assertQuery(error, "moderation log");
  return (data ?? []).map((row) => ({ ...row, moderator: row.moderator?.username ?? "unknown" }));
}
