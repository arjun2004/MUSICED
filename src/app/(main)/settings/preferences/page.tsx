import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/auth/session";
import { PreferencesForm } from "@/features/profile/components/preferences-form";
import { SettingsSkeleton } from "@/features/profile/components/settings-skeleton";

export const metadata = { title: "Privacy & notifications" };

export default function PreferencesPage() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <Body />
    </Suspense>
  );
}

async function Body() {
  const viewer = await requireViewer("/settings/preferences");
  const supabase = await createClient();
  const { data: prefs, error } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", viewer.id)
    .single();
  if (error || !prefs) throw new Error("Could not load your preferences.");

  return (
    <PreferencesForm
      initial={{
        defaultLogVisibility: prefs.default_log_visibility,
        defaultReviewVisibility: prefs.default_review_visibility,
        defaultListVisibility: prefs.default_list_visibility,
        notifyFollows: prefs.notify_follows,
        notifyLikes: prefs.notify_likes,
        notifyComments: prefs.notify_comments,
        notifyMentions: prefs.notify_mentions,
      }}
    />
  );
}
