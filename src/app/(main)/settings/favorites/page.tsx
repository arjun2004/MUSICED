import { Suspense } from "react";
import { SectionHeader } from "@/components/shared/states";
import { requireViewer } from "@/lib/auth/session";
import { getMyFavorites } from "@/features/listening/queries";
import { ShowcaseEditor } from "@/features/profile/components/showcase-editor";
import { SettingsSkeleton } from "@/features/profile/components/settings-skeleton";

export const metadata = { title: "Favourite albums" };

export default function FavoritesSettingsPage() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <Body />
    </Suspense>
  );
}

async function Body() {
  const viewer = await requireViewer("/settings/favorites");
  const favorites = await getMyFavorites(viewer.id);
  return (
    <section>
      <SectionHeader title="Profile showcase" />
      <p className="-mt-2 mb-6 text-sm text-muted-foreground">Pick and order the four albums that headline your profile.</p>
      <ShowcaseEditor favorites={favorites} />
    </section>
  );
}
