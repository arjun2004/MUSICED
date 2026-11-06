import { Suspense } from "react";
import { SectionHeader } from "@/components/shared/states";
import { requireViewer } from "@/lib/auth/session";
import { getFeaturedGenres, getMyFavoriteArtists, getMyGenreSlugs } from "@/features/onboarding/queries";
import { FavoriteArtistsForm } from "@/features/profile/components/favorite-artists-form";
import { TasteForm } from "@/features/profile/components/taste-form";
import { SettingsSkeleton } from "@/features/profile/components/settings-skeleton";

export const metadata = { title: "Taste" };

export default function TasteSettingsPage() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <Body />
    </Suspense>
  );
}

async function Body() {
  const viewer = await requireViewer("/settings/taste");
  const [genres, selected, artists] = await Promise.all([
    getFeaturedGenres(),
    getMyGenreSlugs(viewer.id),
    getMyFavoriteArtists(viewer.id),
  ]);
  return (
    <section>
      <SectionHeader title="Favorite genres" />
      <p className="-mt-2 mb-6 text-sm text-muted-foreground">
        Shown on your profile and used to suggest listeners with similar taste.
      </p>
      <TasteForm genres={genres} initialSelected={selected} />
      <div className="mt-14">
        <SectionHeader title="Favorite artists" />
        <FavoriteArtistsForm initial={artists} />
      </div>
    </section>
  );
}
