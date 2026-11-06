import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CalendarDays, Globe, MapPin, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/profile/user-avatar";
import { FollowButton } from "@/components/social/follow-button";
import { formatCount, formatMonthYear } from "@/lib/utils/format";
import { getProfileByUsername, getProfileMeta, getRelationship } from "@/features/profile/queries";
import { ProfileOverflowMenu } from "@/features/profile/components/profile-actions";
import { ProfileTabs, ProfileTabsView } from "@/features/profile/components/profile-tabs";

export async function generateMetadata({
  params,
}: LayoutProps<"/user/[username]">): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfileMeta(username);
  if (!profile) return { title: "Listener not found" };
  const name = profile.display_name || profile.username;
  return {
    title: `${name} (@${profile.username})`,
    description: profile.bio || `${name}'s listening diary, ratings and reviews on MUSICED.`,
    openGraph: { type: "profile", username: profile.username ?? undefined },
  };
}

export default function ProfileLayout({ children, params }: LayoutProps<"/user/[username]">) {
  return (
    <div className="container-page">
      <Suspense fallback={<ProfileHeaderSkeleton />}>
        <ProfileHeader params={params} />
      </Suspense>
      <div className="py-10">{children}</div>
    </div>
  );
}

async function ProfileHeader({ params }: Pick<LayoutProps<"/user/[username]">, "params">) {
  const { username } = await params;
  const profile = await getProfileByUsername(username);
  if (!profile) notFound();
  const relationship = await getRelationship(profile.id);
  const name = profile.display_name || profile.username;

  return (
    <header className="border-b border-hairline pt-10 sm:pt-14">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
        <UserAvatar user={profile} size="xl" className="ring-4 ring-background" />
        <div className="min-w-0 flex-1">
          <h1 className="heading truncate text-3xl sm:text-4xl">{name}</h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            @{profile.username}
            {relationship.followsViewer ? (
              <span className="ml-2 rounded-[3px] bg-surface-raised px-1.5 py-0.5 text-[0.6875rem] text-foreground/80">
                Follows you
              </span>
            ) : null}
          </p>
          {profile.bio ? (
            <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-pretty text-foreground/85">
              {profile.bio}
            </p>
          ) : null}
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[0.8125rem] text-muted-foreground">
            {profile.location ? (
              <li className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" aria-hidden="true" /> {profile.location}
              </li>
            ) : null}
            {profile.website ? (
              <li className="inline-flex items-center gap-1.5">
                <Globe className="size-3.5" aria-hidden="true" />
                <a
                  href={profile.website}
                  rel="noopener noreferrer nofollow ugc"
                  target="_blank"
                  className="hover:text-foreground hover:underline"
                >
                  {profile.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                </a>
              </li>
            ) : null}
            <li className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" aria-hidden="true" /> Joined {formatMonthYear(profile.created_at)}
            </li>
          </ul>
        </div>

        <div className="flex items-center gap-2 sm:pb-1">
          {relationship.isSelf ? (
            <Button asChild variant="secondary" size="sm">
              <Link href="/settings">
                <Pencil data-icon="inline-start" /> Edit profile
              </Link>
            </Button>
          ) : relationship.hasBlocked ? null : (
            <FollowButton
              userId={profile.id}
              initialFollowing={relationship.isFollowing}
              isSignedIn={relationship.isSignedIn}
            />
          )}
          {!relationship.isSelf ? (
            <ProfileOverflowMenu
              userId={profile.id}
              username={profile.username}
              hasBlocked={relationship.hasBlocked}
              isSignedIn={relationship.isSignedIn}
            />
          ) : null}
        </div>
      </div>

      {relationship.hasBlocked ? (
        <p className="mt-6 rounded-md border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
          You&apos;ve blocked @{profile.username}. Their activity is hidden from you, and yours from them.
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
        <Suspense fallback={<ProfileTabsView username={profile.username} />}>
          <ProfileTabs username={profile.username} />
        </Suspense>
        <dl className="flex gap-6 pb-3 text-sm">
          <div className="flex items-baseline gap-1.5">
            <dt className="sr-only">Followers</dt>
            <dd>
              <Link href={`/user/${profile.username}/followers`} className="hover:text-signal">
                <span className="font-semibold tabular-nums">{formatCount(profile.followers_count)}</span>{" "}
                <span className="text-muted-foreground">followers</span>
              </Link>
            </dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="sr-only">Following</dt>
            <dd>
              <Link href={`/user/${profile.username}/following`} className="hover:text-signal">
                <span className="font-semibold tabular-nums">{formatCount(profile.following_count)}</span>{" "}
                <span className="text-muted-foreground">following</span>
              </Link>
            </dd>
          </div>
        </dl>
      </div>
    </header>
  );
}

function ProfileHeaderSkeleton() {
  return (
    <div className="border-b border-hairline pt-10 pb-6 sm:pt-14" aria-hidden="true">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
        <Skeleton className="size-24 rounded-full sm:size-28" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
      </div>
      <Skeleton className="mt-8 h-5 w-64" />
    </div>
  );
}
