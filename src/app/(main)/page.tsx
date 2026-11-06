import Link from "next/link";
import { Suspense } from "react";
import { MessageSquareText, Radio, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlbumCard, AlbumGrid } from "@/components/albums/album-card";
import { CoverMosaic } from "@/components/albums/cover-mosaic";
import { ActivityItem } from "@/components/social/activity-item";
import { ListenerRow } from "@/components/social/listener-row";
import { ReviewCard } from "@/components/reviews/review-card";
import { UserAvatar } from "@/components/profile/user-avatar";
import { EmptyState, SectionHeader } from "@/components/shared/states";
import { UrlToasts } from "@/components/shared/url-toasts";
import { getViewerProfile } from "@/lib/auth/session";
import { browseAlbums, getFeaturedReviews, getRecommendedAlbums } from "@/features/discovery/queries";
import { getPublicLists } from "@/features/lists/queries";
import { ListCard, ListGrid } from "@/features/lists/components/list-card";
import {
  getCommunityFeed,
  getFollowingFeed,
  getHeroCovers,
  getHighestRatedAlbums,
  getRecentReviews,
  getRecentlyActiveListeners,
  getTrendingAlbums,
} from "@/features/discovery/queries";
import { getSuggestedListeners } from "@/features/social/queries";

export default function DiscoverPage() {
  return (
    <>
      <Suspense fallback={null}>
        <UrlToasts />
      </Suspense>

      <Suspense fallback={<TopSkeleton />}>
        <Top />
      </Suspense>

      <div className="container-page mt-14 grid gap-16">
        <Suspense fallback={null}>
          <RecommendedSection />
        </Suspense>
        <TrendingSection />
        <NewReleasesSection />
        <HighestRatedSection />
        <Suspense fallback={null}>
          <PopularListsSection />
        </Suspense>
        <Suspense fallback={null}>
          <FeaturedReviewsSection />
        </Suspense>

        <div className="grid gap-16 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
          <section aria-labelledby="fresh-reviews">
            <Suspense fallback={<ListSkeleton rows={3} />}>
              <FreshReviews />
            </Suspense>
          </section>
          <aside>
            <Suspense fallback={<ListSkeleton rows={4} />}>
              <ActiveListeners />
            </Suspense>
          </aside>
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Top: hero for visitors, personal feed for members                           */
/* -------------------------------------------------------------------------- */

async function Top() {
  const profile = await getViewerProfile();
  if (!profile) return <Hero />;
  return <MemberHome profile={profile} />;
}

async function Hero() {
  const covers = await getHeroCovers(15);
  return (
    <section className="relative overflow-hidden border-b border-hairline">
      <div className="container-page grid items-center gap-10 py-16 sm:py-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:py-24">
        <div className="relative z-10 animate-fade-up">
          <p className="eyebrow mb-5 !text-signal">Discover. Listen. Rate. Repeat.</p>
          <h1 className="display max-w-xl">
            The social diary for people who live in albums.
          </h1>
          <p className="mt-6 max-w-md text-[1.0625rem] leading-relaxed text-muted-foreground">
            Log every record you play, rate it to the half-star, write about the ones that move you,
            and find your next favourite through listeners with great taste.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="h-11 px-5 text-[0.9375rem] font-semibold">
              <Link href="/signup">Start your diary — it&apos;s free</Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="h-11 px-4 text-[0.9375rem]">
              <Link href="/members">Browse listeners</Link>
            </Button>
          </div>
          <dl className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-hairline pt-6">
            {[
              ["Log", "every listen"],
              ["Rate", "in half-stars"],
              ["Follow", "great taste"],
            ].map(([term, detail]) => (
              <div key={term}>
                <dt className="text-sm font-semibold">{term}</dt>
                <dd className="text-[0.8125rem] text-muted-foreground">{detail}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="relative -mx-4 h-[22rem] sm:mx-0 sm:h-[28rem] lg:h-[32rem]">
          <CoverMosaic albums={covers} columns={5} className="absolute inset-0 rounded-md" />
        </div>
      </div>
    </section>
  );
}

async function MemberHome({
  profile,
}: {
  profile: NonNullable<Awaited<ReturnType<typeof getViewerProfile>>>;
}) {
  const [following, suggestions] = await Promise.all([
    getFollowingFeed(profile.id, 25),
    getSuggestedListeners(profile.id, 5),
  ]);
  const onlyOwn = following.every((item) => item.actor.id === profile.id);
  const feed = onlyOwn ? await getCommunityFeed(15) : following;
  const name = profile.display_name || profile.username || "listener";

  return (
    <section className="border-b border-hairline">
      <div className="container-page py-10 sm:py-12">
        <div className="flex items-center gap-4">
          <UserAvatar user={profile} size="lg" />
          <div>
            <p className="eyebrow mb-1">Welcome back</p>
            <h1 className="heading sm:text-3xl">{name}</h1>
          </div>
        </div>

        {!profile.onboarded_at ? (
          <div className="mt-8 flex flex-col gap-3 rounded-md border border-signal/25 bg-signal/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">
              <span className="font-medium">Finish setting up your profile</span>
              <span className="text-muted-foreground"> to personalise your feed.</span>
            </p>
            <Button asChild size="sm" className="font-semibold">
              <Link href="/onboarding">Continue setup</Link>
            </Button>
          </div>
        ) : null}

        <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <SectionHeader
              eyebrow={onlyOwn ? "Across MUSICED" : "From people you follow"}
              title={onlyOwn ? "Community activity" : "Your feed"}
            />
            {onlyOwn ? (
              <p className="-mt-2 mb-2 text-sm text-muted-foreground">
                Follow a few listeners and their ratings, reviews and diary entries will appear here.
              </p>
            ) : null}
            {feed.length > 0 ? (
              <div className="divide-y divide-hairline">
                {feed.map((item) => (
                  <ActivityItem key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Radio}
                title="It's quiet in here"
                description="The community is just getting started. Activity from listeners will show up here as it happens."
                action={{ label: "Find listeners", href: "/members" }}
                className="mt-4"
              />
            )}
          </div>

          <aside>
            <SectionHeader title="Listeners to follow" href="/members" hrefLabel="All" />
            {suggestions.length > 0 ? (
              <div className="divide-y divide-hairline">
                {suggestions.map((person) => (
                  <ListenerRow key={person.id} person={person} viewerId={profile.id} isFollowing={false} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                You&apos;re following everyone we&apos;d suggest. Nice.
              </p>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Community rails (cached public aggregates — prerendered into the shell)      */
/* -------------------------------------------------------------------------- */

async function TrendingSection() {
  const albums = await getTrendingAlbums(12);
  if (albums.length === 0) return null;
  return (
    <section aria-labelledby="trending">
      <SectionHeader eyebrow="Right now" title="Trending in the community" href="/explore?sort=trending" />
      <AlbumGrid>
        {albums.map((album, i) => (
          <AlbumCard key={album.id} album={album} href={`/album/${album.slug}`} averageRating={album.average_rating} priority={i < 6} />
        ))}
      </AlbumGrid>
    </section>
  );
}

async function RecommendedSection() {
  const profile = await getViewerProfile();
  if (!profile) return null;
  const albums = await getRecommendedAlbums(profile.id, 6);
  if (albums.length === 0) return null;
  return (
    <section aria-labelledby="recommended">
      <SectionHeader eyebrow="Picked from your favourite genres" title="Recommended for you" href="/explore" hrefLabel="Explore" />
      <AlbumGrid>
        {albums.map((album) => (
          <AlbumCard key={album.id} album={album} href={`/album/${album.slug}`} averageRating={album.average_rating} />
        ))}
      </AlbumGrid>
    </section>
  );
}

async function NewReleasesSection() {
  const albums = await browseAlbums({ sort: "new", pageSize: 6 });
  if (albums.length === 0) return null;
  return (
    <section aria-labelledby="new-releases">
      <SectionHeader eyebrow="Fresh pressings" title="New releases" href="/explore?sort=new" />
      <AlbumGrid>
        {albums.map((album) => (
          <AlbumCard
            key={album.id}
            album={album}
            href={`/album/${album.slug}`}
            averageRating={album.ratings_count > 0 ? album.average_rating : undefined}
          />
        ))}
      </AlbumGrid>
    </section>
  );
}

async function PopularListsSection() {
  const lists = await getPublicLists("popular", 3);
  if (lists.length === 0) return null;
  return (
    <section aria-labelledby="popular-lists">
      <SectionHeader eyebrow="Curated by listeners" title="Popular lists" href="/lists" />
      <ListGrid>
        {lists.map((list) => (
          <ListCard key={list.id} list={list} />
        ))}
      </ListGrid>
    </section>
  );
}

async function FeaturedReviewsSection() {
  const reviews = await getFeaturedReviews(3);
  if (reviews.length === 0) return null;
  return (
    <section aria-labelledby="featured-reviews">
      <SectionHeader eyebrow="Most liked lately" title="Featured reviews" />
      <div className="grid gap-x-10 divide-y divide-hairline md:grid-cols-3 md:divide-y-0">
        {reviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>
    </section>
  );
}

async function HighestRatedSection() {
  const albums = await getHighestRatedAlbums(6);
  if (albums.length === 0) return null;
  return (
    <section aria-labelledby="highest-rated">
      <SectionHeader eyebrow="Community favourites" title="Highest rated" href="/charts" hrefLabel="Charts" />
      <AlbumGrid>
        {albums.map((album) => (
          <AlbumCard
            key={album.id}
            album={album}
            href={`/album/${album.slug}`}
            averageRating={album.average_rating}
            ratingsCount={album.ratings_count}
          />
        ))}
      </AlbumGrid>
    </section>
  );
}

async function FreshReviews() {
  const reviews = await getRecentReviews(6);
  return (
    <>
      <SectionHeader eyebrow="Just written" title="Fresh reviews" />
      {reviews.length > 0 ? (
        <div className="divide-y divide-hairline">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={MessageSquareText}
          title="No reviews yet"
          description="Reviews from the community will appear here. The first one could be yours."
        />
      )}
    </>
  );
}

async function ActiveListeners() {
  const listeners = await getRecentlyActiveListeners(10);
  return (
    <>
      <SectionHeader title="Recently active" href="/members" hrefLabel="All" />
      {listeners.length > 0 ? (
        <ul className="flex flex-wrap gap-2.5">
          {listeners.map((person) => (
            <li key={person.id}>
              <Link
                href={`/user/${person.username}`}
                className="group flex flex-col items-center gap-1.5"
                title={person.display_name || person.username}
              >
                <UserAvatar user={person} size="md" className="ring-0 transition group-hover:ring-2 group-hover:ring-signal" />
                <span className="w-14 truncate text-center text-[0.6875rem] text-muted-foreground group-hover:text-foreground">
                  {person.username}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Users} title="No activity yet" className="py-8" />
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */

function TopSkeleton() {
  return (
    <div className="border-b border-hairline">
      <div className="container-page grid gap-10 py-16 lg:grid-cols-2 lg:py-24" aria-hidden="true">
        <div className="space-y-5">
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-14 w-full max-w-lg" />
          <Skeleton className="h-14 w-4/5 max-w-md" />
          <Skeleton className="h-5 w-full max-w-md" />
          <Skeleton className="h-11 w-56" />
        </div>
        <Skeleton className="h-80 lg:h-[30rem]" />
      </div>
    </div>
  );
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div aria-hidden="true">
      <Skeleton className="mb-6 h-6 w-40" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-4 py-4">
          <Skeleton className="size-16 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
