import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlbumCover } from "@/components/albums/album-cover";
import { UserAvatar } from "@/components/profile/user-avatar";
import { RichText } from "@/components/shared/rich-text";
import { StarRating } from "@/components/shared/star-rating";
import { SpoilerText } from "@/components/reviews/spoiler-text";
import { getViewerProfile } from "@/lib/auth/session";
import { formatPartialDate } from "@/lib/utils/format";
import { format, parseISO } from "date-fns";
import { getComments, getReview } from "@/features/reviews/queries";
import { ReviewLikeButton } from "@/features/reviews/components/review-like-button";
import { CommentThread } from "@/features/reviews/components/comment-thread";
import { ReportDialog } from "@/features/moderation/components/report-dialog";
import { ShareButton } from "@/features/lists/components/list-actions";
import { VisibilityBadge } from "@/features/lists/components/visibility-badge";

export async function generateMetadata({ params }: PageProps<"/review/[id]">): Promise<Metadata> {
  const { id } = await params;
  const review = await getReview(id);
  if (!review) return { title: "Review not found" };
  const author = review.author.display_name || review.author.username;
  return {
    title: `${author}'s review of ${review.album.title}`,
    description: review.contains_spoilers ? `A review of ${review.album.title} by ${review.album.artist_credit}.` : review.body.slice(0, 160),
    robots: review.visibility === "public" ? undefined : { index: false },
  };
}

export default function ReviewPage({ params }: PageProps<"/review/[id]">) {
  return (
    <Suspense fallback={<ReviewSkeleton />}>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: Pick<PageProps<"/review/[id]">, "params">) {
  const { id } = await params;
  const [review, comments, viewer] = await Promise.all([getReview(id), getComments(id), getViewerProfile()]);
  if (!review) notFound();
  const author = review.author.display_name || review.author.username;

  return (
    <div className="container-page grid gap-12 py-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:py-14">
      <aside className="max-w-[220px]">
        <Link href={`/album/${review.album.slug}`} className="group block">
          <AlbumCover src={review.album.cover_url} title={review.album.title} artist={review.album.artist_credit} sizes="220px" priority />
          <p className="mt-3 font-semibold tracking-tight group-hover:text-signal">{review.album.title}</p>
          <p className="text-sm text-muted-foreground">
            {review.album.artist_credit}
            {review.album.release_year ? ` · ${formatPartialDate(String(review.album.release_year))}` : ""}
          </p>
        </Link>
      </aside>

      <article className="min-w-0 max-w-2xl">
        <header>
          <Link href={`/user/${review.author.username}`} className="group inline-flex items-center gap-2.5">
            <UserAvatar user={review.author} size="md" />
            <span className="text-sm">
              <span className="text-muted-foreground">Review by </span>
              <span className="font-semibold group-hover:text-signal">{author}</span>
            </span>
          </Link>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {review.rating !== null ? <StarRating value={review.rating} size={18} /> : null}
            <span className="font-mono text-xs text-muted-foreground">
              {format(parseISO(review.created_at), "d MMM yyyy")}
              {review.edited_at ? " · edited" : ""}
            </span>
            <VisibilityBadge visibility={review.visibility} />
          </div>
          {review.title ? <h1 className="heading mt-5 text-3xl">{review.title}</h1> : <h1 className="sr-only">Review of {review.album.title}</h1>}
        </header>

        <SpoilerText hidden={review.contains_spoilers && !review.isAuthor} className="mt-6">
          <RichText text={review.body} className="text-base leading-8" />
        </SpoilerText>

        <div className="mt-8 flex flex-wrap items-center gap-2 border-b border-hairline pb-8">
          <ReviewLikeButton
            reviewId={review.id}
            initialLiked={review.viewerLiked}
            initialCount={review.likes_count}
            isSignedIn={Boolean(review.viewerId)}
            disabled={review.isAuthor}
          />
          <ShareButton path={`/review/${review.id}`} title={`${author} on ${review.album.title}`} />
          {review.isAuthor ? (
            <Link href={`/album/${review.album.slug}`} className="ml-1 text-sm text-muted-foreground hover:text-foreground">
              Edit on the album page
            </Link>
          ) : review.viewerId ? (
            <ReportDialog targetType="review" targetId={review.id} />
          ) : null}
        </div>

        <div className="mt-10">
          <CommentThread
            reviewId={review.id}
            reviewAuthorId={review.author.id}
            initial={comments}
            viewer={
              viewer?.username
                ? { id: viewer.id, username: viewer.username, display_name: viewer.display_name, avatar_path: viewer.avatar_path }
                : null
            }
          />
        </div>
      </article>
    </div>
  );
}

function ReviewSkeleton() {
  return (
    <div className="container-page grid gap-12 py-14 lg:grid-cols-[220px_minmax(0,1fr)]" aria-hidden="true">
      <Skeleton className="aspect-square w-[220px]" />
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-40" />
      </div>
    </div>
  );
}
