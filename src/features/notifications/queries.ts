import "server-only";

import { createClient } from "@/lib/supabase/server";
import { assertQuery } from "@/lib/supabase/errors";
import type { Enums } from "@/types/database";
import type { ProfileSummary } from "@/types/domain";

export type NotificationItem = {
  id: string;
  type: Enums<"notification_type">;
  read_at: string | null;
  created_at: string;
  actor: ProfileSummary;
  review: { id: string; album: { title: string; slug: string; cover_url: string | null; artist_credit: string } } | null;
  comment: { id: string; body: string } | null;
  list: { id: string; title: string } | null;
};

export async function getNotifications(viewerId: string, limit = 50): Promise<NotificationItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select(
      `id, type, read_at, created_at,
       actor:profiles!notifications_actor_id_fkey!inner(id, username, display_name, avatar_path),
       review:reviews(id, album:albums!inner(title, slug, cover_url, artist_credit)),
       comment:review_comments(id, body),
       list:user_lists(id, title)`,
    )
    .eq("recipient_id", viewerId)
    .order("created_at", { ascending: false })
    .limit(limit);
  assertQuery(error, "notifications");
  return (data ?? []) as unknown as NotificationItem[];
}
