import { AlbumCover } from "@/components/albums/album-cover";
import { publicStorageUrl, LIST_COVER_BUCKET } from "@/lib/utils/storage";
import { cn } from "@/lib/utils";
import type { AlbumSummary } from "@/types/domain";

/**
 * Fanned stack of the first albums in a list, like records leaning on a shelf.
 * Empty lists show a single blank sleeve.
 */
export function ListCollage({
  albums,
  className,
  size = "md",
  coverPath,
}: {
  albums: AlbumSummary[];
  className?: string;
  size?: "md" | "lg";
  /** Custom uploaded cover; replaces the generated collage. */
  coverPath?: string | null;
}) {
  const coverUrl = publicStorageUrl(LIST_COVER_BUCKET, coverPath);
  if (coverUrl) {
    return (
      <div className={cn("relative aspect-[2.2/1] overflow-hidden rounded-[3px] bg-surface", className)} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- user upload from our own storage bucket */}
        <img src={coverUrl} alt="" className="size-full object-cover" loading="lazy" />
        <div className="pointer-events-none absolute inset-0 ring-1 ring-white/[0.06] ring-inset" />
      </div>
    );
  }
  const shown = albums.slice(0, 5);
  const coverWidth = size === "lg" ? "w-[38%]" : "w-[36%]";

  if (shown.length === 0) {
    return (
      <div
        className={cn(
          "flex aspect-[2.2/1] items-center justify-center rounded-[3px] border border-dashed border-border bg-surface",
          className,
        )}
        aria-hidden="true"
      >
        <span className="eyebrow">Empty list</span>
      </div>
    );
  }

  return (
    <div className={cn("relative aspect-[2.2/1] overflow-hidden", className)} aria-hidden="true">
      {shown.map((album, i) => (
        <div
          key={album.id}
          className={cn(
            "absolute top-0 transition-transform duration-300 group-hover:translate-x-[var(--fan)]",
            coverWidth,
          )}
          style={
            {
              left: `${i * (64 / Math.max(shown.length - 1, 1))}%`,
              zIndex: shown.length - i,
              "--fan": `${i * 4}%`,
            } as React.CSSProperties
          }
        >
          <AlbumCover
            src={album.cover_url}
            title={album.title}
            artist={album.artist_credit}
            sizes={size === "lg" ? "240px" : "160px"}
            className="shadow-[4px_0_12px_-2px_rgb(0_0_0/0.6)]"
          />
        </div>
      ))}
    </div>
  );
}
