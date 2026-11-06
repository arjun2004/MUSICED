import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { FocusLayout } from "@/components/layout/focus-layout";
import { GroovePattern } from "@/components/albums/cover-mosaic";
import { getViewerProfile, requireViewer } from "@/lib/auth/session";
import { getFeaturedGenres, getMyFavoriteArtists, getMyGenreSlugs } from "@/features/onboarding/queries";
import { OnboardingWizard } from "@/features/onboarding/components/onboarding-wizard";

export const metadata: Metadata = { title: "Set up your profile", robots: { index: false } };

export default function OnboardingPage() {
  return (
    <FocusLayout aside={<OnboardingAside />}>
      <Suspense fallback={<WizardSkeleton />}>
        <OnboardingBody />
      </Suspense>
    </FocusLayout>
  );
}

async function OnboardingBody() {
  const viewer = await requireViewer("/onboarding");
  const [profile, genres, genreSlugs, artists] = await Promise.all([
    getViewerProfile(),
    getFeaturedGenres(),
    getMyGenreSlugs(viewer.id),
    getMyFavoriteArtists(viewer.id),
  ]);
  if (!profile) redirect("/login");
  if (profile.username && profile.onboarded_at) redirect("/");

  return (
    <OnboardingWizard
      genres={genres}
      initial={{
        viewerId: viewer.id,
        username: profile.username,
        displayName: profile.display_name,
        bio: profile.bio,
        avatarPath: profile.avatar_path,
        genreSlugs,
        artists,
      }}
    />
  );
}

function OnboardingAside() {
  return (
    <div className="relative h-full">
      <GroovePattern className="absolute inset-0" />
      <div className="absolute inset-x-0 bottom-0 p-12">
        <p className="eyebrow mb-4 !text-signal">How MUSICED works</p>
        <ul className="grid max-w-sm gap-5">
          {[
            ["Log", "Keep a diary of every album you listen to, re-listens included."],
            ["Rate", "Half-star ratings. Change your mind whenever you like."],
            ["Review", "Write as much or as little as you want."],
            ["Discover", "Follow people with great taste and see what they're playing."],
          ].map(([title, text]) => (
            <li key={title} className="flex gap-4">
              <span className="w-20 shrink-0 font-mono text-xs tracking-widest text-foreground uppercase">{title}</span>
              <span className="text-sm text-muted-foreground">{text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function WizardSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="mb-10 flex gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-0.5 flex-1" />
        ))}
      </div>
      <Skeleton className="mb-3 h-3 w-20" />
      <Skeleton className="mb-8 h-9 w-56" />
      <div className="grid gap-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-24" />
      </div>
    </div>
  );
}
