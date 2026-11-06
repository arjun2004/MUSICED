import Link from "next/link";
import { Heart, MessageCircle } from "lucide-react";
import { AlbumCover } from "@/components/albums/album-cover";
import { UserAvatar } from "@/components/profile/user-avatar";
import { StarRating } from "@/components/shared/star-rating";
import { formatCount } from "@/lib/utils/format";
import type { ReviewCard as ReviewCardData } from "@/types/domain";
import { SpoilerText } from "./spoiler-text";
import { RelativeTime } from "@/components/shared/relative-time";

export function ReviewCard({ review, showAuthor = true }: { review: ReviewCardData; showAuthor?: boolean }) {
  const { album, author } = review;
  return (
    <article className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-4 py-5 sm:grid-cols-[5.5rem_minmax(0,1fr)]">
      <Link href={`/album/${album.slug}`} className="self-start">
        <AlbumCover src={album.cover_url} title={album.title} artist={album.artist_credit} sizes="88px" />
      </Link>
      <div className="min-w-0">
        <header>
          <h3 className="truncate text-[0.9375rem] font-semibold tracking-tight">
            <Link href={`/album/${album.slug}`} className="hover:text-signal">
              {album.title}
            </Link>
            {album.release_year ? (
              <span className="ml-1.5 font-normal text-muted-foreground">{album.release_year}</span>
            ) : null}
          </h3>
          <p className="truncate text-[0.8125rem] text-muted-foreground">{album.artist_credit}</p>
          <div className="mt-2 flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
            {showAuthor ? (
              <Link href={`/user/${author.username}`} className="group inline-flex items-center gap-1.5">
                <UserAvatar user={author} size="xs" />
                <span className="font-medium text-foreground group-hover:text-signal">
                  {author.display_name || author.username}
                </span>
              </Link>
            ) : null}
            {review.rating !== null ? <StarRating value={Number(review.rating)} size={12} compact /> : null}
            <span className="font-mono text-xs text-muted-foreground/70"><RelativeTime iso={review.created_at} /></span>
          </div>
        </header>
        {review.title ? <p className="mt-3 font-medium">{review.title}</p> : null}
        <SpoilerText hidden={review.contains_spoilers} className="mt-2">
          <Link href={`/review/${review.id}`} className="block hover:text-foreground">
            <p className="line-clamp-4 text-sm leading-relaxed whitespace-pre-line text-foreground/85">{review.body}</p>
          </Link>
        </SpoilerText>
        <footer className="mt-3 flex items-center gap-4 font-mono text-xs text-muted-foreground">
          <Link href={`/review/${review.id}`} className="font-sans text-foreground/80 hover:text-signal">
            Read review →
          </Link>
          <span className="inline-flex items-center gap-1" aria-label={`${review.likes_count} likes`}>
            <Heart className="size-3.5" aria-hidden="true" /> {formatCount(review.likes_count)}
          </span>
          <span className="inline-flex items-center gap-1" aria-label={`${review.comments_count} comments`}>
            <MessageCircle className="size-3.5" aria-hidden="true" /> {formatCount(review.comments_count)}
          </span>
        </footer>
      </div>
    </article>
  );
}
