import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Heart, MessageSquareText, NotebookPen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlbumCard } from "@/components/albums/album-card";
import { AlbumCover } from "@/components/albums/album-cover";
import { ReviewCard } from "@/components/reviews/review-card";
import { RatingHistogram } from "@/components/shared/rating-histogram";
import { StarRating } from "@/components/shared/star-rating";
import { EmptyState, SectionHeader } from "@/components/shared/states";
import { getViewer } from "@/lib/auth/session";
import { formatCount } from "@/lib/utils/format";
import { getMonthlyListening } from "@/features/listening/queries";
import { ListeningChart } from "@/features/listening/components/listening-chart";
import {
  getFavoriteAlbums,
  getFavoriteArtists,
  getFavoriteGenres,
  getProfileByUsername,
  getProfileReviews,
  getProfileStats,
  getRecentDiary,
} from "@/features/profile/queries";

export default function ProfilePage({ params }: PageProps<"/user/[username]">) {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <ProfileOverview params={params} />
    </Suspense>
  );
}

async function ProfileOverview({ params }: Pick<PageProps<"/user/[username]">, "params">) {
  const { username } = await params;
  const profile = await getProfileByUsername(username);
  if (!profile) notFound();

  const [viewer, stats, genres, favorites, diary, reviews, monthly, artists] = await Promise.all([
    getViewer(),
    getProfileStats(profile.id),
    getFavoriteGenres(profile.id),
    getFavoriteAlbums(profile.id),
    getRecentDiary(profile.id, 8),
    getProfileReviews(profile.id, 3),
    getMonthlyListening(profile.id),
    getFavoriteArtists(profile.id),
  ]);
  const isSelf = viewer?.id === profile.id;
  const firstName = profile.display_name?.split(" ")[0] || profile.username;

  return (
    <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12">
      <div className="grid gap-14">
        <section aria-labelledby="favorites">
          <SectionHeader eyebrow="All-time" title="Favorite albums" />
          {favorites.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {favorites.map((album) => (
                <AlbumCard key={album.id} album={album} href={`/album/${album.slug}`} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Heart}
              title={isSelf ? "Pin your four favorite albums" : `${firstName} hasn't picked favorites yet`}
              description={isSelf ? "Your all-time top four will live here." : undefined}
              className="py-10"
            />
          )}
        </section>

        <section aria-labelledby="recent-diary">
          <SectionHeader eyebrow="Diary" title="Recently listened" href={`/user/${profile.username}/diary`} hrefLabel="Full diary" />
          {diary.length > 0 ? (
            <ul className="grid grid-cols-4 gap-3 sm:grid-cols-8">
              {diary.map((entry) => (
                <li key={entry.id} className="min-w-0">
                  <Link href={`/album/${entry.album.slug}`} className="block">
                  <AlbumCover
                    src={entry.album.cover_url}
                    title={entry.album.title}
                    artist={entry.album.artist_credit}
                    sizes="120px"
                  />
                  </Link>
                  <div className="mt-1.5 flex items-center justify-between gap-1">
                    {entry.rating !== null ? (
                      <StarRating value={Number(entry.rating)} size={9} compact />
                    ) : (
                      <span />
                    )}
                    {entry.is_favorite ? <Heart className="size-3 fill-signal text-signal" aria-label="Loved" /> : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={NotebookPen}
              title={isSelf ? "Your diary is empty" : "No diary entries to show"}
              description={
                isSelf
                  ? "Every album you log will appear here, newest first."
                  : `${firstName}'s public diary entries will show up here.`
              }
              className="py-10"
            />
          )}
        </section>

        <section aria-labelledby="recent-reviews">
          <SectionHeader eyebrow="Writing" title="Recent reviews" href={`/user/${profile.username}/reviews`} hrefLabel="All reviews" />
          {reviews.length > 0 ? (
            <div className="divide-y divide-hairline">
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} showAuthor={false} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={MessageSquareText}
              title={isSelf ? "You haven't written a review yet" : "No reviews to show"}
              className="py-10"
            />
          )}
        </section>
      </div>

      <aside className="grid content-start gap-10">
        <section aria-label="Listening statistics">
          <SectionHeader title="Stats" />
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
            {[
              ["Albums logged", stats.logs],
              ["This year", stats.logsThisYear],
              ["Ratings", stats.ratings],
              ["Reviews", stats.reviews],
              ["Lists", stats.lists],
            ].map(([label, value]) => (
              <div key={label as string}>
                <dd className="text-2xl font-semibold tracking-tight tabular-nums">{formatCount(value as number)}</dd>
                <dt className="eyebrow mt-0.5 !text-[0.625rem]">{label}</dt>
              </div>
            ))}
          </dl>
        </section>

        <section aria-label="Albums logged per month">
          <SectionHeader title="Listening" />
          <ListeningChart data={monthly} />
        </section>

        <section aria-label="Rating distribution">
          <SectionHeader title="Ratings" />
          {stats.ratings > 0 ? (
            <RatingHistogram buckets={stats.histogram} />
          ) : (
            <p className="text-sm text-muted-foreground">No ratings yet.</p>
          )}
        </section>

        {artists.length > 0 ? (
          <section aria-label="Favorite artists">
            <SectionHeader title="Favorite artists" />
            <ul className="flex flex-wrap gap-1.5">
              {artists.map((artist) => (
                <li key={artist.id}>
                  <Link
                    href={`/artist/${artist.slug}`}
                    className="inline-block rounded-full border border-border bg-surface px-2.5 py-1 text-[0.8125rem] text-foreground/85 hover:border-foreground/30 hover:text-foreground"
                  >
                    {artist.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-label="Favorite genres">
          <SectionHeader title="Into" />
          {genres.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {genres.map((genre) => (
                <li
                  key={genre.id}
                  className="rounded-full border border-border bg-surface px-2.5 py-1 text-[0.8125rem] text-foreground/85"
                >
                  {genre.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {isSelf ? (
                <>
                  No genres picked yet.{" "}
                  <Link href="/settings" className="text-foreground underline-offset-2 hover:underline">
                    Add some
                  </Link>
                </>
              ) : (
                "No genres picked yet."
              )}
            </p>
          )}
        </section>
      </aside>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_300px]" aria-hidden="true">
      <div className="grid gap-10">
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-8 gap-3">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}
