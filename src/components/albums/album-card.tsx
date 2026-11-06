import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatAverage } from "@/lib/utils/format";
import type { AlbumSummary } from "@/types/domain";
import { AlbumCover } from "./album-cover";
import { Star } from "@/components/shared/star-rating";

/**
 * Album tile used in grids and rails. `href` is optional so the catalog can be
 * displayed before album detail pages exist for a given surface.
 */
export function AlbumCard({
  album,
  href,
  averageRating,
  ratingsCount,
  meta,
  priority,
  className,
}: {
  album: AlbumSummary;
  href?: string;
  averageRating?: number | null;
  ratingsCount?: number;
  meta?: React.ReactNode;
  priority?: boolean;
  className?: string;
}) {
  const body = (
    <>
      <div className="relative">
        <AlbumCover
          src={album.cover_url}
          title={album.title}
          artist={album.artist_credit}
          priority={priority}
          className="transition duration-300 group-hover:brightness-110"
        />
        {averageRating !== undefined && averageRating !== null ? (
          <span className="absolute right-1.5 bottom-1.5 inline-flex items-center gap-1 rounded-[3px] bg-background/85 px-1.5 py-0.5 font-mono text-[0.6875rem] text-foreground tabular-nums backdrop-blur-sm">
            <Star fill={1} size={10} />
            {formatAverage(averageRating)}
          </span>
        ) : null}
      </div>
      <div className="mt-2.5 min-w-0">
        <p className="truncate text-sm leading-snug font-medium text-foreground group-hover:text-signal">
          {album.title}
        </p>
        <p className="truncate text-[0.8125rem] leading-snug text-muted-foreground">
          {album.artist_credit}
          {album.release_year ? <span className="text-muted-foreground/60"> · {album.release_year}</span> : null}
        </p>
        {meta ? <div className="mt-1">{meta}</div> : null}
        {ratingsCount !== undefined && ratingsCount > 0 && !meta ? (
          <p className="eyebrow mt-1 !text-[0.625rem]">{ratingsCount} ratings</p>
        ) : null}
      </div>
    </>
  );

  return href ? (
    <Link href={href} className={cn("group block min-w-0 rounded-[3px]", className)}>
      {body}
    </Link>
  ) : (
    <div className={cn("group min-w-0", className)}>{body}</div>
  );
}

export function AlbumGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
