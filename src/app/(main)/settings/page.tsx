import { Suspense } from "react";
import { SectionHeader } from "@/components/shared/states";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/auth/session";
import { AvatarUploader } from "@/features/profile/components/avatar-uploader";
import { ProfileForm } from "@/features/profile/components/profile-form";
import { SettingsSkeleton } from "@/features/profile/components/settings-skeleton";

export const metadata = { title: "Profile" };

export default function ProfileSettingsPage() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <Body />
    </Suspense>
  );
}

async function Body() {
  const viewer = await requireViewer("/settings");
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, bio, location, website, avatar_path")
    .eq("id", viewer.id)
    .single();

  return (
    <div className="grid gap-12">
      <section>
        <SectionHeader title="Photo" />
        <AvatarUploader
          user={{
            username: profile?.username ?? null,
            display_name: profile?.display_name ?? null,
            avatar_path: profile?.avatar_path ?? null,
          }}
        />
      </section>
      <section>
        <SectionHeader title="Profile" />
        <ProfileForm
          initial={{
            username: profile?.username ?? "",
            displayName: profile?.display_name ?? "",
            bio: profile?.bio ?? "",
            location: profile?.location ?? "",
            website: profile?.website ?? "",
          }}
        />
      </section>
    </div>
  );
}
